use crate::builtins;
use crate::diagnostics::{self, SourceDiagnostic};
use crate::json::JsonValue as Value;
use crate::module::{CompiledModuleGraph, ModuleBindings};
use crate::pattern::MatchKind;
use crate::resolver::Resolver;
use crate::resolver::graph::ModuleMember;
use crate::runtime::{
    DeclarationMetadata, InputMode, RuleExecution, Runtime, RuntimeDiagnostic, RuntimeError,
    runtime_input,
};
use crate::value::Value as RuntimeValue;
use std::collections::HashMap;
use std::fmt;
use std::rc::Rc;
use uffda_heap::{Arena, Collect, Rootable};
use url::Url;

/// Warm module bindings keyed by language module URL. Ephemeral match state lives
/// only in [`LanguageSession::execution`] so it can be dropped after serialize.
#[derive(Collect)]
#[collect(no_drop)]
struct WarmGraph<'gc> {
    #[collect(require_static)]
    graph: Rc<CompiledModuleGraph>,
    bindings: ModuleBindings<'gc>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct WarmEntry<'gc> {
    #[collect(require_static)]
    url: Url,
    graph: WarmGraph<'gc>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct LanguageSession<'gc> {
    warm: Vec<WarmEntry<'gc>>,
    execution: Option<RuleExecution<'gc>>,
    #[collect(require_static)]
    active: Option<Url>,
    #[collect(require_static)]
    active_graph: Option<Rc<CompiledModuleGraph>>,
}

impl<'gc> LanguageSession<'gc> {
    fn new() -> Self {
        Self {
            warm: Vec::new(),
            execution: None,
            active: None,
            active_graph: None,
        }
    }

    fn take_warm(&mut self, url: &Url) -> Option<WarmGraph<'gc>> {
        self.warm
            .iter()
            .position(|entry| entry.url == *url)
            .map(|index| self.warm.swap_remove(index).graph)
    }

    fn reclaim(&mut self) {
        let Some(mut execution) = self.execution.take() else {
            self.active = None;
            self.active_graph = None;
            return;
        };
        let url = self.active.take();
        let graph = self.active_graph.take();
        let bindings = execution.take_bindings_after_run();
        if let (Some(url), Some(graph), Some(bindings)) = (url, graph, bindings) {
            self.warm.push(WarmEntry {
                url,
                graph: WarmGraph { graph, bindings },
            });
        }
    }

    fn invalidate(&mut self, url: &Url) {
        self.warm.retain(|entry| entry.url != *url);
        if self.active.as_ref() == Some(url) {
            self.reclaim();
        }
    }
}

/// Process-long GC heap for language parse/compile runs.
struct LanguageHeap {
    arena: Arena<Rootable![LanguageSession<'_>]>,
}

impl LanguageHeap {
    fn new() -> Self {
        Self {
            arena: Arena::new(|_mc| LanguageSession::new()),
        }
    }

    fn invalidate(&mut self, url: &Url) {
        self.arena.mutate_root(|_, session| session.invalidate(url));
        self.arena.finish_cycle();
    }

    fn run_member(
        &mut self,
        cache_url: &Url,
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: Value,
        mode: InputMode,
    ) -> Result<MemberRun, RuntimeError> {
        self.arena.mutate_root(|mc, session| {
            session.reclaim();
            let warm = match session.take_warm(cache_url) {
                Some(warm) if Rc::ptr_eq(&warm.graph, &graph) => warm,
                _ => WarmGraph {
                    graph: Rc::clone(&graph),
                    bindings: ModuleBindings::with_environment(mc, &graph, None)
                        .map_err(RuntimeError::Module)?,
                },
            };
            let items = runtime_input(mc, input, mode)?;
            let execution = RuleExecution::for_member_with_bindings(
                mc,
                Rc::clone(&warm.graph),
                warm.bindings,
                member,
                items,
            )?;
            session.active = Some(cache_url.clone());
            session.active_graph = Some(warm.graph);
            session.execution = Some(execution);
            Ok::<(), RuntimeError>(())
        })?;

        self.run_until_complete()?;

        let diagnostics = self.diagnostics_with(|declaration| {
            let RuntimeValue::Object(metadata) = declaration.metadata.raw() else {
                return None;
            };
            let RuntimeValue::Object(documentation) = metadata.borrow().get("Documentation")?.raw()
            else {
                return None;
            };
            let RuntimeValue::String(error) = documentation.borrow().get("error")?.raw() else {
                return None;
            };
            error.to_utf8().ok()
        });

        let failed = self.arena.mutate(|_, session| {
            session
                .execution
                .as_ref()
                .and_then(|execution| execution.result())
                .is_some_and(|result| result.kind == MatchKind::Fail)
        });
        if failed {
            self.reclaim_and_collect();
            return Ok(MemberRun {
                value: None,
                metadata: None,
                diagnostics,
                failed: true,
            });
        }

        let value = self.serialize_result()?;
        let metadata = self.serialize_metadata(member)?;
        self.reclaim_and_collect();
        Ok(MemberRun {
            value,
            metadata,
            diagnostics,
            failed: false,
        })
    }

    fn run_until_complete(&mut self) -> Result<(), RuntimeError> {
        const STEPS_PER_MUTATION: usize = 512;
        loop {
            let (status, _) = self.arena.mutate_root(|mc, session| {
                let execution = session
                    .execution
                    .as_mut()
                    .ok_or(RuntimeError::InvalidState)?;
                execution.run_batch(mc, STEPS_PER_MUTATION)
            })?;
            self.arena.collect_debt();
            match status {
                crate::evaluate::StepStatus::Complete => return Ok(()),
                crate::evaluate::StepStatus::Yielded => {}
                crate::evaluate::StepStatus::Suspended => {
                    return Err(crate::evaluate::EvaluationError::HostPending.into());
                }
            }
        }
    }

    fn serialize_result(&mut self) -> Result<Option<String>, RuntimeError> {
        self.arena.mutate_root(|mc, session| {
            session
                .execution
                .as_mut()
                .ok_or(RuntimeError::InvalidState)?
                .begin_serialize_result(mc)
        })?;
        self.run_until_complete()?;
        self.arena.mutate(|_, session| {
            session
                .execution
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .serialized_json()
        })
    }

    fn serialize_metadata(
        &mut self,
        member: &ModuleMember,
    ) -> Result<Option<String>, RuntimeError> {
        self.arena.mutate_root(|mc, session| {
            session
                .execution
                .as_mut()
                .ok_or(RuntimeError::InvalidState)?
                .begin_serialize_metadata(mc, member)
        })?;
        self.run_until_complete()?;
        self.arena.mutate(|_, session| {
            session
                .execution
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .serialized_json()
        })
    }

    fn diagnostics_with(
        &self,
        explain: impl for<'gc> Fn(&DeclarationMetadata<'gc>) -> Option<String>,
    ) -> Vec<RuntimeDiagnostic> {
        self.arena.mutate(|_, session| {
            session
                .execution
                .as_ref()
                .map(|execution| execution.diagnostics_with(&explain))
                .unwrap_or_default()
        })
    }

    fn reclaim_and_collect(&mut self) {
        self.arena.mutate_root(|_, session| session.reclaim());
        self.arena.finish_cycle();
    }

    #[cfg(test)]
    fn warm_binding_ptr(&self, url: &Url) -> Option<usize> {
        self.arena.mutate(|_, session| {
            session
                .warm
                .iter()
                .find(|entry| entry.url == *url)
                .and_then(|entry| {
                    entry
                        .graph
                        .bindings
                        .environment(url)
                        .map(|env| env.identity())
                })
        })
    }
}

struct MemberRun {
    value: Option<String>,
    metadata: Option<String>,
    diagnostics: Vec<RuntimeDiagnostic>,
    failed: bool,
}

#[derive(Clone, Debug)]
pub struct ProjectLanguage {
    pub id: String,
    pub extensions: Vec<String>,
    pub module: Url,
    pub entry: String,
    pub formatter: Option<(Url, String)>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Language {
    Uffda,
    Pattern,
    Expression,
}

impl Language {
    pub fn id(self) -> &'static str {
        match self {
            Self::Uffda => "uffda",
            Self::Pattern => "pattern",
            Self::Expression => "expression",
        }
    }

    fn entry(self) -> (&'static str, &'static str) {
        match self {
            Self::Uffda => ("src/lang/uffda/uffda.lang.uff", "UffdaLang"),
            Self::Pattern => ("src/lang/pattern/pattern.lang.uff", "PatternLang"),
            Self::Expression => ("src/lang/expression/expression.lang.uff", "ExpressionLang"),
        }
    }
}

#[derive(Debug)]
pub struct LanguageError {
    pub phase: &'static str,
    pub module_url: String,
    pub message: String,
    pub diagnostics: Vec<SourceDiagnostic>,
}

pub struct ParsedSource {
    pub value: Value,
    pub diagnostics: Vec<SourceDiagnostic>,
}

struct LanguageOutcome {
    value: Value,
    metadata: Value,
    diagnostics: Vec<SourceDiagnostic>,
}

impl fmt::Display for LanguageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{}: {} ({})",
            self.phase, self.message, self.module_url
        )
    }
}

impl std::error::Error for LanguageError {}

pub struct Languages {
    resolver: Resolver,
    root: Url,
    programs: HashMap<Url, Rc<CompiledModuleGraph>>,
    heap: LanguageHeap,
}

impl Languages {
    pub fn new() -> Result<Self, LanguageError> {
        let resolver = Resolver::from_cwd().map_err(|error| LanguageError {
            phase: "resolve",
            module_url: error.module_url,
            message: error.message,
            diagnostics: vec![],
        })?;
        Self::with_resolver(resolver)
    }

    pub fn with_resolver(mut resolver: Resolver) -> Result<Self, LanguageError> {
        let root = builtins::register(&mut resolver).map_err(|error| LanguageError {
            phase: "resolve",
            module_url: error.module_url,
            message: error.message,
            diagnostics: vec![],
        })?;
        Ok(Self {
            resolver,
            root,
            programs: HashMap::new(),
            heap: LanguageHeap::new(),
        })
    }

    fn execute(
        &mut self,
        path: &str,
        entry: &str,
        input: Value,
        mode: InputMode,
    ) -> Result<Value, LanguageError> {
        let url = self.root.join(path).map_err(|error| LanguageError {
            phase: "resolve",
            module_url: path.into(),
            message: error.to_string(),
            diagnostics: vec![],
        })?;
        self.execute_url(&url, entry, input, mode)
            .map(|(value, _)| value)
    }

    fn execute_url(
        &mut self,
        url: &Url,
        entry: &str,
        input: Value,
        mode: InputMode,
    ) -> Result<(Value, Value), LanguageError> {
        let outcome = self.execute_url_outcome(url, entry, input, mode)?;
        if !outcome.diagnostics.is_empty() {
            return Err(LanguageError {
                phase: "match",
                module_url: url.to_string(),
                message: outcome
                    .diagnostics
                    .iter()
                    .map(|diagnostic| diagnostic.message.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
                diagnostics: outcome.diagnostics,
            });
        }
        Ok((outcome.value, outcome.metadata))
    }

    fn execute_url_outcome(
        &mut self,
        url: &Url,
        entry: &str,
        input: Value,
        mode: InputMode,
    ) -> Result<LanguageOutcome, LanguageError> {
        let error = |phase, message: String| LanguageError {
            phase,
            module_url: url.to_string(),
            message,
            diagnostics: vec![],
        };
        let source = match &input {
            Value::String(text) => text
                .to_utf8()
                .map_err(|failure| error("input", failure.to_string()))?,
            _ => String::new(),
        };
        let graph = self.graph(url)?;
        let member = graph
            .export(url, Some(entry))
            .or_else(|| graph.resolve(url, entry))
            .ok_or_else(|| error("resolve", format!("Unknown rule {entry}")))?;
        let run = self
            .heap
            .run_member(url, graph, &member, input, mode)
            .map_err(|failure| error("execute", failure.to_string()))?;
        let diagnostics = diagnostics::map_runtime_diagnostics(
            run.diagnostics,
            &source,
            "CLI_STREAM_PARSE_RECOVERED",
            "CLI_STREAM_PARSE_FAILURE",
            "parse",
        )
        .map_err(|failure| error("output", failure.to_string()))?;
        if run.failed {
            return Err(LanguageError {
                phase: "match",
                module_url: url.to_string(),
                message: diagnostics
                    .iter()
                    .map(|diagnostic| diagnostic.message.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
                diagnostics,
            });
        }
        let value = run.value.ok_or_else(|| {
            error(
                "output",
                "Language rule did not produce an AST value".into(),
            )
        })?;
        let metadata = run
            .metadata
            .ok_or_else(|| error("output", "Language rule has no metadata object".into()))?;
        let value = crate::json::from_str(&value)
            .map_err(|failure| error("output", failure.to_string()))?;
        let metadata = crate::json::from_str(&metadata)
            .map_err(|failure| error("output", failure.to_string()))?;
        Ok(LanguageOutcome {
            value,
            metadata,
            diagnostics,
        })
    }

    fn graph(&mut self, url: &Url) -> Result<Rc<CompiledModuleGraph>, LanguageError> {
        let error = |phase, message: String| LanguageError {
            phase,
            module_url: url.to_string(),
            message,
            diagnostics: vec![],
        };
        Ok(match self.programs.get(url) {
            Some(graph) => Rc::clone(graph),
            None => {
                let graph = self
                    .resolver
                    .load_graph(url)
                    .map_err(|failure| error("resolve", failure.to_string()))?;
                let graph = Rc::new(
                    CompiledModuleGraph::compile_reusing(
                        graph,
                        self.programs.values().map(Rc::as_ref),
                    )
                    .map_err(|failure| error("compile", failure.to_string()))?,
                );
                self.heap.invalidate(url);
                self.programs.insert(url.clone(), Rc::clone(&graph));
                graph
            }
        })
    }

    pub fn languages_of(&mut self, url: &Url) -> Result<Vec<ProjectLanguage>, LanguageError> {
        let error = |message: String| LanguageError {
            phase: "configuration",
            module_url: url.to_string(),
            message,
            diagnostics: vec![],
        };
        let graph = self.graph(url)?;
        let module = graph
            .graph
            .modules
            .get(url)
            .ok_or_else(|| error("Missing language module".into()))?;
        let members: Vec<_> = module
            .exports
            .values()
            .filter(|member| member.kind == crate::resolver::graph::MemberKind::Rule)
            .cloned()
            .collect();
        let mut runtime =
            Runtime::metadata(graph.clone()).map_err(|failure| error(failure.to_string()))?;
        runtime
            .run()
            .map_err(|failure| error(failure.to_string()))?;
        let mut languages = Vec::new();
        for member in members {
            let text = runtime
                .serialize_metadata(&member)
                .map_err(|failure| error(failure.to_string()))?
                .ok_or_else(|| error("Missing declaration metadata".into()))?;
            let metadata: Value =
                crate::json::from_str(&text).map_err(|failure| error(failure.to_string()))?;
            let Some(language) = metadata.get("Language") else {
                continue;
            };
            let id = language
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .ok_or_else(|| error("[Language] needs a non-empty string id".into()))?;
            let extensions = language
                .get("extensions")
                .and_then(Value::as_array)
                .filter(|extensions| !extensions.is_empty())
                .ok_or_else(|| {
                    error(format!(
                        "[Language] {id} needs a non-empty extensions array"
                    ))
                })?;
            let extensions: Vec<_> = extensions
                .iter()
                .map(|value| {
                    value
                        .as_str()
                        .filter(|extension| {
                            extension.starts_with('.')
                                && extension.len() > 1
                                && !extension[1..]
                                    .chars()
                                    .any(|c| c == '.' || c == '/' || c == '\\' || c.is_whitespace())
                        })
                        .map(str::to_lowercase)
                        .ok_or_else(|| error(format!("[Language] {id} has an invalid extension")))
                })
                .collect::<Result<_, _>>()?;
            let formatter = metadata
                .get("Formatter")
                .map(|formatter| {
                    if formatter["kind"] != "rule" {
                        return Err(error("Formatter must name a rule".into()));
                    }
                    let module = formatter["moduleUrl"]
                        .as_str()
                        .ok_or_else(|| error("Formatter has no module URL".into()))?;
                    let name = formatter["name"]
                        .as_str()
                        .ok_or_else(|| error("Formatter has no rule name".into()))?;
                    Ok((
                        Url::parse(module).map_err(|failure| error(failure.to_string()))?,
                        name.into(),
                    ))
                })
                .transpose()?;
            let declaration = graph
                .declaration(&member)
                .ok_or_else(|| error("Missing language declaration".into()))?;
            languages.push(ProjectLanguage {
                id: id.into(),
                extensions,
                module: member.module_url.clone(),
                entry: declaration.name.clone(),
                formatter,
            });
        }
        if languages.is_empty() {
            return Err(error(
                "Module exports no rule with [Language] metadata".into(),
            ));
        }
        Ok(languages)
    }

    pub fn project_languages(
        &mut self,
        project: Option<&crate::project::Project>,
    ) -> Result<Vec<ProjectLanguage>, LanguageError> {
        let builtin_url = self
            .root
            .join(Language::Uffda.entry().0)
            .expect("static builtin path");
        let mut builtin = self.languages_of(&builtin_url)?;
        let Some(project) = project else {
            return Ok(builtin);
        };
        let base = Url::from_directory_path(&project.root).map_err(|()| LanguageError {
            phase: "configuration",
            module_url: project.root.display().to_string(),
            message: "Invalid project root".into(),
            diagnostics: vec![],
        })?;
        let mut declared = Vec::new();
        for specifier in &project.languages {
            let error = |message| LanguageError {
                phase: "configuration",
                module_url: specifier.clone(),
                message,
                diagnostics: vec![],
            };
            let specifier = crate::resolver::graph::unfurl_specifier(&project.imports, specifier)
                .map_err(error)?;
            let url = base
                .join(&specifier)
                .map_err(|failure| error(failure.to_string()))?;
            let url = self
                .resolver
                .canonical_url(&url)
                .map_err(|failure| error(failure.to_string()))?;
            declared.extend(self.languages_of(&url)?);
        }
        for (index, language) in declared.iter().enumerate() {
            for other in &declared[..index] {
                if language.id == other.id
                    || language
                        .extensions
                        .iter()
                        .any(|extension| other.extensions.contains(extension))
                {
                    return Err(LanguageError {
                        phase: "configuration",
                        module_url: project.path.display().to_string(),
                        message: format!(
                            "Languages {} and {} claim the same id or extension",
                            other.id, language.id
                        ),
                        diagnostics: vec![],
                    });
                }
            }
        }
        builtin.retain(|language| !declared.iter().any(|other| other.id == language.id));
        for language in &mut builtin {
            language.extensions.retain(|extension| {
                !declared
                    .iter()
                    .any(|other| other.extensions.contains(extension))
            });
        }
        builtin.extend(declared);
        Ok(builtin)
    }

    pub fn format_language(
        &mut self,
        source: &str,
        language: &ProjectLanguage,
    ) -> Result<String, LanguageError> {
        let error = |message| LanguageError {
            phase: "format",
            module_url: language.module.to_string(),
            message,
            diagnostics: vec![],
        };
        let (module, entry) = language
            .formatter
            .as_ref()
            .ok_or_else(|| error("Language has no Formatter".into()))?;
        let (syntax, _) = self.execute_url(
            &language.module,
            &language.entry,
            Value::String(source.into()),
            InputMode::Scalar,
        )?;
        let (value, _) = self
            .execute_url(module, entry, syntax, InputMode::Scalar)
            .map_err(|mut failure| {
                failure.phase = "format";
                failure
            })?;
        match value {
            Value::String(text) => text.to_utf8().map_err(|failure| error(failure.to_string())),
            _ => Err(error("Formatter rule did not produce text".into())),
        }
    }

    pub fn parse(&mut self, source: &str, language: Language) -> Result<Value, LanguageError> {
        let (path, entry) = language.entry();
        self.execute(path, entry, Value::String(source.into()), InputMode::Scalar)
    }

    /// Parse the data language's scalar-safe AST (string contents remain JSON tokens).
    pub fn parse_data(&mut self, source: &str) -> Result<serde_json::Value, LanguageError> {
        let path = "src/lang/data/data.lang.uff";
        let encode_error = |message: String| LanguageError {
            phase: "output",
            module_url: path.into(),
            message,
            diagnostics: vec![],
        };
        let url = self
            .root
            .join(path)
            .map_err(|failure| encode_error(failure.to_string()))?;
        let graph = self.graph(&url)?;
        let member = graph
            .export(&url, Some("DataLang"))
            .or_else(|| graph.resolve(&url, "DataLang"))
            .ok_or_else(|| encode_error("Unknown rule DataLang".into()))?;
        let mut runtime = Runtime::for_member(
            graph,
            &member,
            Value::String(source.into()),
            InputMode::Scalar,
        )
        .map_err(|failure| encode_error(failure.to_string()))?;
        runtime
            .run()
            .map_err(|failure| encode_error(failure.to_string()))?;
        let diagnostics = diagnostics::collect(
            &runtime,
            source,
            "CLI_STREAM_PARSE_RECOVERED",
            "CLI_STREAM_PARSE_FAILURE",
            "parse",
        )
        .map_err(|failure| encode_error(failure.to_string()))?;
        if !diagnostics.is_empty() {
            return Err(LanguageError {
                phase: "parse",
                module_url: url.to_string(),
                message: diagnostics
                    .iter()
                    .map(|diagnostic| diagnostic.message.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
                diagnostics,
            });
        }
        runtime.read(|execution| {
            let matched = execution
                .result()
                .ok_or_else(|| encode_error("Missing data AST".into()))?;
            if matched.kind != MatchKind::Ok {
                return Err(encode_error(
                    "Data language did not match the record".into(),
                ));
            }
            scalar_data_ast(matched.value).map_err(encode_error)
        })
    }

    pub fn parse_source(
        &mut self,
        source: &str,
        language: Language,
    ) -> Result<ParsedSource, LanguageError> {
        let (path, entry) = language.entry();
        let url = self.root.join(path).expect("static language path");
        let outcome =
            self.execute_url_outcome(&url, entry, Value::String(source.into()), InputMode::Scalar)?;
        Ok(ParsedSource {
            value: outcome.value,
            diagnostics: outcome.diagnostics,
        })
    }

    /// Parse `source` and classify gap-free highlight spans from rule metadata
    /// (`Highlight` / `Keyword`), matching the MCP/LSP highlighting contract.
    pub fn highlight(
        &mut self,
        source: &str,
        language: Language,
    ) -> Result<serde_json::Value, LanguageError> {
        let (path, entry) = language.entry();
        let url = self.root.join(path).expect("static language path");
        let graph = self.graph(&url)?;
        let member = graph
            .export(&url, Some(entry))
            .or_else(|| graph.resolve(&url, entry))
            .ok_or_else(|| LanguageError {
                phase: "parse",
                module_url: url.to_string(),
                message: format!("Unknown rule {entry}"),
                diagnostics: vec![],
            })?;
        let mut runtime = Runtime::for_member(
            graph,
            &member,
            Value::String(source.into()),
            InputMode::Scalar,
        )
        .map_err(|failure| LanguageError {
            phase: "parse",
            module_url: url.to_string(),
            message: failure.to_string(),
            diagnostics: vec![],
        })?;
        runtime.run().map_err(|failure| LanguageError {
            phase: "parse",
            module_url: url.to_string(),
            message: failure.to_string(),
            diagnostics: vec![],
        })?;
        let diagnostics = diagnostics::collect(
            &runtime,
            source,
            "CLI_STREAM_PARSE_RECOVERED",
            "CLI_STREAM_PARSE_FAILURE",
            "parse",
        )
        .map_err(|failure| LanguageError {
            phase: "parse",
            module_url: url.to_string(),
            message: failure.to_string(),
            diagnostics: vec![],
        })?;
        Ok(crate::highlight::from_runtime(&runtime, source, &diagnostics))
    }
    pub fn compile(&mut self, syntax: Value) -> Result<Value, LanguageError> {
        self.execute(
            "src/lang/uffda/runtime.compiler.uff",
            "UffdaRuntimeCompiler",
            syntax,
            InputMode::Scalar,
        )
    }

    pub fn module_specifier(&mut self, text: &str) -> Result<Value, LanguageError> {
        self.execute(
            "src/lang/uffda/specifier.rules.uff",
            "ModuleSpecifierText",
            Value::String(text.into()),
            InputMode::Scalar,
        )
    }

    pub fn format(&mut self, source: &str, language: Language) -> Result<String, LanguageError> {
        let (path, entry) = language.entry();
        let url = self.root.join(path).map_err(|failure| LanguageError {
            phase: "resolve",
            module_url: path.into(),
            message: failure.to_string(),
            diagnostics: vec![],
        })?;
        let (syntax, metadata) =
            self.execute_url(&url, entry, Value::String(source.into()), InputMode::Scalar)?;
        let error = |message: String| LanguageError {
            phase: "format",
            module_url: url.to_string(),
            message,
            diagnostics: vec![],
        };
        let formatter = metadata
            .get("Formatter")
            .ok_or_else(|| error("Language entry rule has no Formatter metadata".into()))?;
        if formatter["kind"] != "rule" {
            return Err(error("Formatter metadata must name a rule".into()));
        }
        let module = formatter["moduleUrl"]
            .as_str()
            .ok_or_else(|| error("Formatter metadata has no module URL".into()))?;
        let name = formatter["name"]
            .as_str()
            .ok_or_else(|| error("Formatter metadata has no rule name".into()))?;
        let module = Url::parse(module).map_err(|failure| error(failure.to_string()))?;
        let (value, _) = self.execute_url(&module, name, syntax, InputMode::Scalar)?;
        match value {
            Value::String(text) => text.to_utf8().map_err(|failure| error(failure.to_string())),
            _ => Err(error("Formatter rule did not produce text".into())),
        }
    }
}

fn scalar_data_ast(value: crate::value::Value<'_>) -> Result<serde_json::Value, String> {
    use crate::value::Value as RuntimeValue;
    enum Work<'gc> {
        Visit(RuntimeValue<'gc>),
        Array(usize, usize),
        Object(Vec<String>, usize),
    }
    let mut pending = vec![Work::Visit(value)];
    struct Values(Vec<serde_json::Value>);
    impl std::ops::Deref for Values {
        type Target = Vec<serde_json::Value>;
        fn deref(&self) -> &Self::Target {
            &self.0
        }
    }
    impl std::ops::DerefMut for Values {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.0
        }
    }
    impl Drop for Values {
        fn drop(&mut self) {
            let mut pending = std::mem::take(&mut self.0);
            while let Some(value) = pending.pop() {
                match value {
                    serde_json::Value::Array(items) => pending.extend(items),
                    serde_json::Value::Object(items) => pending.extend(items.into_values()),
                    _ => {}
                }
            }
        }
    }
    let mut values = Values(Vec::new());
    let mut active = std::collections::HashSet::new();
    while let Some(work) = pending.pop() {
        match work {
            Work::Visit(value) => match value.raw() {
                RuntimeValue::Null => values.push(serde_json::Value::Null),
                RuntimeValue::Boolean(value) => values.push(serde_json::Value::Bool(value)),
                RuntimeValue::Number(value) => values.push(serde_json::Value::Number(
                    serde_json::Number::from_f64(value).ok_or("Nonfinite data AST number")?,
                )),
                RuntimeValue::String(value) => values.push(serde_json::Value::String(
                    value.to_utf8().map_err(|failure| failure.to_string())?,
                )),
                RuntimeValue::Array(array) => {
                    let identity = uffda_heap::Gc::as_ptr(array) as usize;
                    if !active.insert(identity) {
                        return Err("Cyclic data AST".into());
                    }
                    let array = array.borrow();
                    pending.push(Work::Array(array.len(), identity));
                    pending.extend(array.iter().rev().copied().map(Work::Visit));
                }
                RuntimeValue::Object(object) => {
                    let identity = uffda_heap::Gc::as_ptr(object) as usize;
                    if !active.insert(identity) {
                        return Err("Cyclic data AST".into());
                    }
                    let object = object.borrow();
                    if !object.symbol_entries().is_empty() {
                        return Err("Symbol data AST keys".into());
                    }
                    let keys = object
                        .entries()
                        .iter()
                        .map(|(key, _)| key.to_utf8().map_err(|failure| failure.to_string()))
                        .collect::<Result<Vec<_>, _>>()?;
                    pending.push(Work::Object(keys, identity));
                    pending.extend(
                        object
                            .entries()
                            .iter()
                            .rev()
                            .map(|(_, value)| Work::Visit(*value)),
                    );
                }
                _ => return Err("Unsupported data AST value".into()),
            },
            Work::Array(count, identity) => {
                let start = values.len() - count;
                let items = values.split_off(start);
                values.push(serde_json::Value::Array(items));
                active.remove(&identity);
            }
            Work::Object(keys, identity) => {
                let start = values.len() - keys.len();
                let items = values.split_off(start);
                values.push(serde_json::Value::Object(
                    keys.into_iter().zip(items).collect(),
                ));
                active.remove(&identity);
            }
        }
    }
    values.pop().ok_or_else(|| "Missing data AST value".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:runtime-strings-002 req:data-codec-003
    fn data_language_ast_depth_is_not_limited_by_json_reparsing() {
        let source = "[".repeat(128) + "null" + &"]".repeat(128);
        let ast = Languages::new().unwrap().parse_data(&source).unwrap();
        let limits = crate::codec::data::DataLimits {
            max_bytes: 10_000,
            max_depth: 128,
        };
        let document = crate::codec::data::DataDocument::from_ast(ast, limits).unwrap();
        assert_eq!(document.encode(false, limits).unwrap(), source);
        uffda_heap::rootless_mutate(|mc| {
            let non_scalar = crate::value::Value::string(
                mc,
                crate::text::RuntimeString::from_utf16(vec![0xd800]),
            );
            assert!(scalar_data_ast(non_scalar).is_err());
        });
    }

    #[test]
    // req:runtime-strings-002 req:data-codec-002
    fn data_language_tokens_are_scalar_safe_without_decoding_surrogates_early() {
        let mut languages = Languages::new().unwrap();
        let ast = languages.parse_data(r#""\ud800""#).unwrap();
        assert_eq!(ast["kind"], "string");
        assert_eq!(ast["token"], r#""\ud800""#);
        assert!(languages.parse_data(r#""\ud80""#).is_err());
    }

    #[test]
    // req:cli-bootstrap-024 req:modules-runtime-004
    fn overlapping_language_graphs_reuse_compiled_declaration_identity() {
        let mut languages = Languages::new().unwrap();
        let expression = languages.root.join(Language::Expression.entry().0).unwrap();
        let pattern = languages.root.join(Language::Pattern.entry().0).unwrap();
        let first = languages.graph(&expression).unwrap();
        let second = languages.graph(&pattern).unwrap();
        let mut shared = 0;
        for (url, module) in &first.graph.modules {
            if second.graph.modules.contains_key(url) {
                for member in module.locals.values() {
                    assert!(Rc::ptr_eq(
                        &first.declaration(member).unwrap(),
                        &second.declaration(member).unwrap(),
                    ));
                    shared += 1;
                }
            }
        }
        assert!(shared > 0);
        assert!(Rc::ptr_eq(&first, &languages.graph(&expression).unwrap()));
    }

    #[test]
    // req:cli-exec-001 req:cli-bootstrap-024
    fn embedded_expression_language_parses_literals_and_invocations() {
        let mut languages = Languages::new().unwrap();
        let ast = languages.parse("42", Language::Expression).unwrap();
        assert_eq!(ast["kind"], "number");
        assert_eq!(ast["value"].as_f64(), Some(42.0));
        let ast = languages
            .parse("(add 20 22)", Language::Expression)
            .unwrap();
        assert_eq!(ast["kind"], "invocation");
        assert_eq!(ast["expression"]["name"], "add");
    }

    #[test]
    // req:cli-match-001 req:cli-bootstrap-030
    fn embedded_pattern_language_parses_a_literal_and_rejects_invalid_source() {
        let mut languages = Languages::new().unwrap();
        let ast = languages.parse("\"x\"", Language::Pattern).unwrap();
        assert_eq!(ast["kind"], "equal");
        assert!(languages.parse("(", Language::Pattern).is_err());
    }

    #[test]
    // req:cli-bootstrap-034 req:cli-run-001
    fn existing_compiler_lowers_parsed_module_without_rewriting_artifacts() {
        let mut languages = Languages::new().unwrap();
        let syntax = languages
            .parse("export Main;\nrule Main = any;", Language::Uffda)
            .unwrap();
        assert_eq!(syntax["kind"], "module");
        let declaration = languages.compile(syntax).unwrap();
        assert!(declaration["rules"].is_array());
        assert_eq!(declaration["rules"].as_array().unwrap()[0]["name"], "Main");
    }

    #[test]
    // req:cli-compile-006
    fn recovered_source_retains_ast_and_explanations_but_strict_parse_rejects_it() {
        let mut languages = Languages::new().unwrap();
        let source = "export Main; rule Main = any";
        let parsed = languages.parse_source(source, Language::Uffda).unwrap();
        assert_eq!(parsed.value["kind"], "module");
        assert_eq!(parsed.diagnostics.len(), 1);
        assert_eq!(parsed.diagnostics[0].code, "CLI_STREAM_PARSE_RECOVERED");
        assert!(
            parsed.diagnostics[0]
                .message
                .starts_with("A declaration ends with `;`.")
        );
        let error = languages.parse(source, Language::Uffda).unwrap_err();
        assert_eq!(error.diagnostics.len(), 1);
    }

    #[test]
    // req:cli-fmt-001 req:uffda-language-syntax-014
    fn formatting_uses_entry_metadata_and_the_existing_formatter_grammar() {
        let mut languages = Languages::new().unwrap();
        let output = languages
            .format("export Main;rule Main=any;", Language::Uffda)
            .unwrap();
        assert!(output.contains("rule Main = any;"), "{output}");
        assert_eq!(languages.format(&output, Language::Uffda).unwrap(), output);
    }

    #[test]
    // req:cli-fmt-001 req:project-file-001
    fn project_languages_read_exported_metadata_without_executing_rule_bodies() {
        let root = std::env::temp_dir().join(format!("uffda-registry-{}", std::process::id()));
        let url = Url::from_file_path(root.join("language.json")).unwrap();
        let mut grammar = Languages::new().unwrap();
        let source = r#"export Custom;
decorator Language<c:any> = c;
[Language { id: "custom", extensions: [".UFF" ".custom"] }]
rule Custom = MissingBodyRule;"#;
        let syntax = grammar.parse(source, Language::Uffda).unwrap();
        let declaration = grammar.compile(syntax).unwrap();
        let mut resolver = Resolver::new(root.clone(), root.join("bin")).unwrap();
        resolver.insert_declaration(
            url.clone(),
            crate::resolver::decode_declaration(&url, &declaration.to_string()).unwrap(),
        );
        let project = crate::project::Project::parse(
            r#"{"languages":["./language.json"]}"#,
            root.join("uffda.jsonc"),
            &mut grammar,
        )
        .unwrap();
        let mut grammar = Languages::with_resolver(resolver).unwrap();
        let languages = grammar.project_languages(Some(&project)).unwrap();
        assert_eq!(languages.len(), 2);
        assert!(languages[0].extensions.is_empty());
        assert_eq!(languages[1].id, "custom");
        assert_eq!(languages[1].extensions, [".uff", ".custom"]);
        assert!(languages[1].formatter.is_none());
        let mut duplicate = project;
        duplicate.languages.push("./language.json".into());
        assert!(
            grammar
                .project_languages(Some(&duplicate))
                .unwrap_err()
                .message
                .contains("same id or extension")
        );
    }

    #[test]
    // req:runtime-memory-005
    fn language_heap_reuses_warm_module_bindings_across_parses() {
        let mut languages = Languages::new().unwrap();
        let source = "export Main; rule Main = any;";
        let first = languages.parse(source, Language::Uffda).unwrap();
        let url = languages
            .root
            .join("src/lang/uffda/uffda.lang.uff")
            .unwrap();
        let first_id = languages
            .heap
            .warm_binding_ptr(&url)
            .expect("warm bindings after first parse");
        let _ = languages.compile(first).unwrap();
        let after_compile = languages
            .heap
            .warm_binding_ptr(&url)
            .expect("warm bindings after compile");
        // compile uses a different module URL (runtime.compiler); uffda.lang stays warm.
        assert_eq!(first_id, after_compile);
        let second = languages.parse(source, Language::Uffda).unwrap();
        let second_id = languages
            .heap
            .warm_binding_ptr(&url)
            .expect("warm bindings after second parse");
        assert_eq!(first_id, second_id);
        let _ = languages.compile(second).unwrap();
    }
}

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
        include_metadata: bool,
    ) -> Result<MemberRun, RuntimeError> {
        self.begin_member(cache_url, graph, member, |mc| {
            runtime_input(mc, input, mode)
        })?;
        self.run_until_complete()?;
        let diagnostics = self.member_diagnostics();
        let failed = self.member_failed();
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
        let metadata = if include_metadata {
            self.serialize_metadata(member)?
        } else {
            None
        };
        self.reclaim_and_collect();
        Ok(MemberRun {
            value,
            metadata,
            diagnostics,
            failed: false,
        })
    }

    fn begin_member(
        &mut self,
        cache_url: &Url,
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: impl for<'gc> FnOnce(
            &uffda_heap::Mutation<'gc>,
        ) -> Result<Vec<RuntimeValue<'gc>>, RuntimeError>,
    ) -> Result<(), RuntimeError> {
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
            let items = input(mc)?;
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
        })
    }

    fn member_diagnostics(&self) -> Vec<RuntimeDiagnostic> {
        self.diagnostics_with(|declaration| {
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
        })
    }

    fn member_failed(&self) -> bool {
        self.arena.mutate(|_, session| {
            session
                .execution
                .as_ref()
                .and_then(|execution| execution.result())
                .is_some_and(|result| result.kind == MatchKind::Fail)
        })
    }

    fn run_native_member(
        &mut self,
        cache_url: &Url,
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: &crate::codec::data::DataDocument,
    ) -> Result<NativeMemberRun, RuntimeError> {
        self.begin_member(cache_url, graph, member, |mc| {
            Ok(vec![input.materialize(mc).wrap_root(mc)])
        })?;
        self.run_until_complete()?;
        let diagnostics = self.member_diagnostics();
        let failed = self.member_failed();
        let value = if failed {
            Ok(None)
        } else {
            self.arena.mutate(|_, session| {
                let result = session
                    .execution
                    .as_ref()
                    .and_then(|execution| execution.result())
                    .ok_or(RuntimeError::InvalidState)?;
                crate::codec::data::DataDocument::from_value(
                    result.value,
                    crate::codec::data::DataLimits::default(),
                )
                .map(Some)
                .map_err(|error| {
                    RuntimeError::Expression(crate::evaluate::EvaluationError::Native(
                        error.to_string(),
                    ))
                })
            })
        };
        self.reclaim_and_collect();
        Ok(NativeMemberRun {
            value: value?,
            diagnostics,
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

struct NativeMemberRun {
    value: Option<crate::codec::data::DataDocument>,
    diagnostics: Vec<RuntimeDiagnostic>,
}

#[derive(Clone, Debug)]
pub struct ProjectLanguage {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub extensions: Vec<String>,
    pub module: Url,
    pub entry: String,
    pub formatter: Option<(Url, String)>,
    /// Rule named by `[ToggleComment]` on the language entry, if any.
    pub toggle_comment: Option<(Url, String)>,
    /// Project-file `languages` specifier this came from, or `None` for the
    /// built-in `.uff` language (see Deno `ProjectLanguage.specifier`).
    pub specifier: Option<String>,
}

/// Languages the LSP/CLI may serve for a workspace, plus non-fatal problems.
#[derive(Clone, Debug, Default)]
pub struct ServedLanguages {
    pub languages: Vec<ProjectLanguage>,
    pub problems: Vec<String>,
}

impl ProjectLanguage {
    /// Built-in `.uff` language (no project-file specifier).
    pub fn is_builtin(&self) -> bool {
        self.specifier.is_none()
    }
}

/// File extension of `uri_or_path` (lowercased, with leading dot), if any.
pub fn extension_of(uri_or_path: &str) -> Option<String> {
    let without_query = uri_or_path.split(['?', '#']).next().unwrap_or(uri_or_path);
    let last_slash = without_query.rfind(['/', '\\']).map(|i| i + 1).unwrap_or(0);
    let name = &without_query[last_slash..];
    let dot = name.rfind('.')?;
    if dot == 0 {
        return None;
    }
    Some(name[dot..].to_ascii_lowercase())
}

/// Language owning `uri_or_path` by extension, if any.
pub fn language_for_document<'a>(
    languages: &'a [ProjectLanguage],
    uri_or_path: &str,
) -> Option<&'a ProjectLanguage> {
    let extension = extension_of(uri_or_path)?;
    languages
        .iter()
        .find(|language| language.extensions.iter().any(|ext| ext == &extension))
}

/// Keep one language per id and per extension. A project language takes over
/// an id or extension of the built-in language. An id or extension two or more
/// project languages claim is a problem: none of them keeps it.
fn settle_ownership(
    builtin: Vec<ProjectLanguage>,
    declared: Vec<ProjectLanguage>,
) -> ServedLanguages {
    let mut problems = Vec::new();
    let mut id_claims: HashMap<String, Vec<String>> = HashMap::new();
    for language in &declared {
        id_claims
            .entry(language.id.clone())
            .or_default()
            .push(language.id.clone());
    }
    let mut shared_ids = std::collections::HashSet::new();
    for (id, claiming) in &id_claims {
        if claiming.len() > 1 {
            shared_ids.insert(id.clone());
            problems.push(format!(
                "The language id '{id}' is declared by more than one language in uffda.jsonc; none of them is served"
            ));
        }
    }
    let unique: Vec<_> = declared
        .into_iter()
        .filter(|language| !shared_ids.contains(&language.id))
        .collect();

    let mut extension_claims: HashMap<String, Vec<String>> = HashMap::new();
    for language in &unique {
        let mut seen = std::collections::HashSet::new();
        for extension in &language.extensions {
            if !seen.insert(extension.clone()) {
                continue;
            }
            extension_claims
                .entry(extension.clone())
                .or_default()
                .push(language.id.clone());
        }
    }
    let mut shared_extensions = std::collections::HashSet::new();
    for (extension, claiming) in &extension_claims {
        if claiming.len() > 1 {
            shared_extensions.insert(extension.clone());
            let describe = claiming
                .iter()
                .map(|id| format!("'{id}'"))
                .collect::<Vec<_>>()
                .join(", ");
            problems.push(format!(
                "The '{extension}' extension is claimed by more than one language ({describe}) in uffda.jsonc; none of them serves it"
            ));
        }
    }

    let mut languages = Vec::new();
    for mut language in builtin {
        if id_claims.contains_key(&language.id) {
            continue;
        }
        language
            .extensions
            .retain(|extension| !extension_claims.contains_key(extension));
        languages.push(language);
    }
    for mut language in unique {
        language
            .extensions
            .retain(|extension| !shared_extensions.contains(extension));
        languages.push(language);
    }
    ServedLanguages {
        languages,
        problems,
    }
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

/// One parse of a source text: highlight spans plus the projected match tree.
pub struct Analysis {
    pub spans: Vec<crate::highlight::HighlightSpan>,
    pub tree: Option<crate::mcp::ops::RetainedMatch>,
    pub diagnostics: Vec<SourceDiagnostic>,
    /// Owned AST from the same parse, when the grammar produced a value.
    /// Callers can compile/load this without a JSON round trip or reparsing.
    pub syntax: Option<crate::codec::data::DataDocument>,
}

struct LanguageOutcome {
    value: Value,
    metadata: Option<Value>,
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
        // Embedded grammars do not depend on process cwd. Use a private
        // absolute artifact root so callers (LSP/MCP) can set the real
        // project root via `Project` / `Resolver::new` separately.
        let root = std::env::temp_dir().join("uffda-languages");
        let out_dir = root.join("bin");
        let _ = std::fs::create_dir_all(&out_dir);
        let resolver = Resolver::new(root, out_dir).map_err(|error| LanguageError {
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
    }

    fn execute_url(
        &mut self,
        url: &Url,
        entry: &str,
        input: Value,
        mode: InputMode,
    ) -> Result<Value, LanguageError> {
        let outcome = self.execute_url_outcome(url, entry, input, mode, false)?;
        Self::checked_outcome(url, outcome).map(|(value, _)| value)
    }

    fn execute_url_with_metadata(
        &mut self,
        url: &Url,
        entry: &str,
        input: Value,
        mode: InputMode,
    ) -> Result<(Value, Value), LanguageError> {
        let outcome = self.execute_url_outcome(url, entry, input, mode, true)?;
        let (value, metadata) = Self::checked_outcome(url, outcome)?;
        Ok((
            value,
            metadata.ok_or_else(|| LanguageError {
                phase: "output",
                module_url: url.to_string(),
                message: "Language rule has no metadata object".into(),
                diagnostics: vec![],
            })?,
        ))
    }

    fn checked_outcome(
        url: &Url,
        outcome: LanguageOutcome,
    ) -> Result<(Value, Option<Value>), LanguageError> {
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
        include_metadata: bool,
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
            .run_member(url, graph, &member, input, mode, include_metadata)
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
        let value = crate::json::from_str(&value)
            .map_err(|failure| error("output", failure.to_string()))?;
        let metadata = run
            .metadata
            .map(|metadata| {
                crate::json::from_str(&metadata)
                    .map_err(|failure| error("output", failure.to_string()))
            })
            .transpose()?;
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
            let name = language
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_owned);
            let description = language
                .get("description")
                .and_then(Value::as_str)
                .map(str::to_owned);
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
            let rule_meta = |decorator: &str| -> Result<Option<(Url, String)>, LanguageError> {
                let Some(rule) = metadata.get(decorator) else {
                    return Ok(None);
                };
                if rule["kind"] != "rule" {
                    return Err(error(format!("{decorator} must name a rule")));
                }
                let module = rule["moduleUrl"]
                    .as_str()
                    .ok_or_else(|| error(format!("{decorator} has no module URL")))?;
                let name = rule["name"]
                    .as_str()
                    .ok_or_else(|| error(format!("{decorator} has no rule name")))?;
                Ok(Some((
                    Url::parse(module).map_err(|failure| error(failure.to_string()))?,
                    name.into(),
                )))
            };
            let formatter = rule_meta("Formatter")?;
            let toggle_comment = rule_meta("ToggleComment")?;
            let declaration = graph
                .declaration(&member)
                .ok_or_else(|| error("Missing language declaration".into()))?;
            languages.push(ProjectLanguage {
                id: id.into(),
                name,
                description,
                extensions,
                module: member.module_url.clone(),
                entry: declaration.name.clone(),
                formatter,
                toggle_comment,
                specifier: None,
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
            let mut languages = self.languages_of(&url)?;
            for language in &mut languages {
                language.specifier = Some(specifier.clone());
            }
            declared.extend(languages);
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

    /// Soft project-language load for the language server: problems never stop
    /// other languages from being served (req:cli-language-server-002).
    pub fn served_languages(
        &mut self,
        project: Option<&crate::project::Project>,
    ) -> ServedLanguages {
        let builtin_url = self
            .root
            .join(Language::Uffda.entry().0)
            .expect("static builtin path");
        let builtin = match self.languages_of(&builtin_url) {
            Ok(languages) => languages,
            Err(error) => {
                return ServedLanguages {
                    languages: Vec::new(),
                    problems: vec![format!("The built-in .uff language: {error}")],
                };
            }
        };
        let Some(project) = project else {
            return ServedLanguages {
                languages: builtin,
                problems: Vec::new(),
            };
        };
        let base = match Url::from_directory_path(&project.root) {
            Ok(url) => url,
            Err(()) => {
                return ServedLanguages {
                    languages: builtin,
                    problems: vec![format!("{}: Invalid project root", project.path.display())],
                };
            }
        };
        let mut declared = Vec::new();
        let mut problems = Vec::new();
        for specifier in &project.languages {
            let resolved = (|| {
                let unfurled =
                    crate::resolver::graph::unfurl_specifier(&project.imports, specifier)?;
                let url = base
                    .join(&unfurled)
                    .map_err(|failure| failure.to_string())?;
                self.resolver
                    .canonical_url(&url)
                    .map_err(|failure| failure.to_string())
            })();
            let url = match resolved {
                Ok(url) => url,
                Err(message) => {
                    problems.push(format!("uffda.jsonc language \"{specifier}\": {message}"));
                    continue;
                }
            };
            match self.languages_of(&url) {
                Ok(mut languages) => {
                    for language in &mut languages {
                        language.specifier = Some(specifier.clone());
                    }
                    declared.extend(languages);
                }
                Err(error) => {
                    problems.push(format!("uffda.jsonc language \"{specifier}\": {error}"));
                }
            }
        }
        let settled = settle_ownership(builtin, declared);
        problems.extend(settled.problems);
        ServedLanguages {
            languages: settled.languages,
            problems,
        }
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
        let syntax = self.execute_url(
            &language.module,
            &language.entry,
            Value::String(source.into()),
            InputMode::Scalar,
        )?;
        let value = self
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

    /// Toggle comments on whole-line `text` with the language's `[ToggleComment]`
    /// rule (req:cli-language-server-009). Does not parse the document — the
    /// toggle rule receives the line text directly.
    pub fn toggle_comment_language(
        &mut self,
        text: &str,
        language: &ProjectLanguage,
    ) -> Result<String, LanguageError> {
        let error = |message| LanguageError {
            phase: "toggleComment",
            module_url: language.module.to_string(),
            message,
            diagnostics: vec![],
        };
        let (module, entry) = language
            .toggle_comment
            .as_ref()
            .ok_or_else(|| error("Language has no ToggleComment".into()))?;
        let value = self
            .execute_url(module, entry, Value::String(text.into()), InputMode::Scalar)
            .map_err(|mut failure| {
                failure.phase = "toggleComment";
                failure
            })?;
        match value {
            Value::String(toggled) => toggled
                .to_utf8()
                .map_err(|failure| error(failure.to_string())),
            _ => Err(error("ToggleComment rule did not produce text".into())),
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
        let outcome = self.execute_url_outcome(
            &url,
            entry,
            Value::String(source.into()),
            InputMode::Scalar,
            false,
        )?;
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
        let (runtime, diagnostics) = self.parse_runtime_member(source, &url, entry, false)?;
        Ok(crate::highlight::from_runtime(
            &runtime,
            source,
            &diagnostics,
        ))
    }

    /// Highlight using a project-served language entry rule.
    pub fn highlight_language(
        &mut self,
        source: &str,
        language: &ProjectLanguage,
    ) -> Result<serde_json::Value, LanguageError> {
        let (runtime, diagnostics) =
            self.parse_runtime_member(source, &language.module, &language.entry, false)?;
        Ok(crate::highlight::from_runtime(
            &runtime,
            source,
            &diagnostics,
        ))
    }

    /// Parse `source` once and return both the gap-free highlight spans and the
    /// projected match tree (character-offset spans, rule metadata) for
    /// editor walks. A failed or recovered parse still yields whatever tree
    /// the runtime produced.
    pub fn analyze(&mut self, source: &str, language: Language) -> Result<Analysis, LanguageError> {
        let (path, entry) = language.entry();
        let url = self.root.join(path).expect("static language path");
        self.analyze_member(source, &url, entry, false)
    }

    /// [`Languages::analyze`] for a project-served language entry rule.
    pub fn analyze_language(
        &mut self,
        source: &str,
        language: &ProjectLanguage,
    ) -> Result<Analysis, LanguageError> {
        self.analyze_member(source, &language.module, &language.entry, false)
    }

    /// [`Languages::analyze`] for `source` as an open input: a prefix of a longer
    /// text still being written, so repetitions record the element they expect
    /// at its end (completion contexts read those expectations).
    pub fn analyze_open(
        &mut self,
        source: &str,
        language: Language,
    ) -> Result<Analysis, LanguageError> {
        let (path, entry) = language.entry();
        let url = self.root.join(path).expect("static language path");
        self.analyze_member(source, &url, entry, true)
    }

    /// Open-input analyze for a project-served language entry rule.
    pub fn analyze_open_language(
        &mut self,
        source: &str,
        language: &ProjectLanguage,
    ) -> Result<Analysis, LanguageError> {
        self.analyze_member(source, &language.module, &language.entry, true)
    }

    fn analyze_member(
        &mut self,
        source: &str,
        url: &Url,
        entry: &str,
        open: bool,
    ) -> Result<Analysis, LanguageError> {
        let (runtime, diagnostics) = self.parse_runtime_member(source, url, entry, open)?;
        let spans = crate::highlight::spans_from_runtime(&runtime, source);
        let tree =
            crate::mcp::ops::project_match_tree(&runtime).map_err(|error| LanguageError {
                phase: "output",
                module_url: url.to_string(),
                message: error,
                diagnostics: vec![],
            })?;
        // Serialize after projecting the match tree: serialization mutates the
        // runtime, but the tree/spans only need a finished parse.
        let syntax = if diagnostics.is_empty() {
            runtime
                .read(|execution| {
                    execution.result().map(|result| {
                        crate::codec::data::DataDocument::from_value(
                            result.value,
                            crate::codec::data::DataLimits::default(),
                        )
                    })
                })
                .transpose()
                .map_err(|error| LanguageError {
                    phase: "output",
                    module_url: url.to_string(),
                    message: error.to_string(),
                    diagnostics: vec![],
                })?
        } else {
            None
        };
        Ok(Analysis {
            spans,
            tree,
            diagnostics,
            syntax,
        })
    }

    fn parse_runtime_member(
        &mut self,
        source: &str,
        url: &Url,
        entry: &str,
        open: bool,
    ) -> Result<(Runtime, Vec<SourceDiagnostic>), LanguageError> {
        let graph = self.graph(url)?;
        let member = graph
            .export(url, Some(entry))
            .or_else(|| graph.resolve(url, entry))
            .ok_or_else(|| LanguageError {
                phase: "parse",
                module_url: url.to_string(),
                message: format!("Unknown rule {entry}"),
                diagnostics: vec![],
            })?;
        let input = Value::String(source.into());
        let mut runtime = if open {
            Runtime::for_member_open(graph, &member, input, InputMode::Scalar)
        } else {
            Runtime::for_member(graph, &member, input, InputMode::Scalar)
        }
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
        Ok((runtime, diagnostics))
    }

    pub fn compile(&mut self, syntax: Value) -> Result<Value, LanguageError> {
        self.execute(
            "src/lang/uffda/runtime.compiler.uff",
            "UffdaRuntimeCompiler",
            syntax,
            InputMode::Scalar,
        )
    }

    pub fn parse_source_native(
        &mut self,
        source: &str,
        language: Language,
    ) -> Result<crate::codec::data::DataDocument, LanguageError> {
        let (path, entry) = language.entry();
        let error = |phase, message: String| LanguageError {
            phase,
            module_url: path.into(),
            message,
            diagnostics: vec![],
        };
        let source_data = crate::codec::data::DataDocument::from_nodes(
            vec![crate::codec::data::DataNode::String(source.into())],
            0,
            crate::codec::data::DataLimits::default(),
        )
        .map_err(|failure| error("input", failure.to_string()))?;
        let url = self
            .root
            .join(path)
            .map_err(|failure| error("resolve", failure.to_string()))?;
        let graph = self.graph(&url)?;
        let member = graph
            .export(&url, Some(entry))
            .or_else(|| graph.resolve(&url, entry))
            .ok_or_else(|| error("resolve", format!("Unknown rule {entry}")))?;
        let run = self
            .heap
            .run_native_member(&url, graph, &member, &source_data)
            .map_err(|failure| error("execute", failure.to_string()))?;
        let diagnostics = diagnostics::map_runtime_diagnostics(
            run.diagnostics,
            source,
            "CLI_STREAM_PARSE_RECOVERED",
            "CLI_STREAM_PARSE_FAILURE",
            "parse",
        )
        .map_err(|failure| error("output", failure.to_string()))?;
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
        run.value.ok_or_else(|| {
            error(
                "output",
                "Language rule did not produce a native AST value".into(),
            )
        })
    }

    /// Parse and lower source without serializing either grammar's result as JSON.
    pub fn compile_source_native(
        &mut self,
        source: &str,
    ) -> Result<crate::codec::data::DataDocument, LanguageError> {
        let syntax = self.parse_source_native(source, Language::Uffda)?;
        self.compile_syntax_native(source, syntax)
    }

    pub fn compile_syntax_native(
        &mut self,
        source: &str,
        syntax: crate::codec::data::DataDocument,
    ) -> Result<crate::codec::data::DataDocument, LanguageError> {
        let error = |phase, path: &str, message: String| LanguageError {
            phase,
            module_url: path.into(),
            message,
            diagnostics: vec![],
        };
        let mut input = syntax;
        {
            let (path, entry) = (
                "src/lang/uffda/runtime.compiler.uff",
                "UffdaRuntimeCompiler",
            );
            let url = self
                .root
                .join(path)
                .map_err(|failure| error("resolve", path, failure.to_string()))?;
            let graph = self.graph(&url)?;
            let member = graph
                .export(&url, Some(entry))
                .or_else(|| graph.resolve(&url, entry))
                .ok_or_else(|| error("resolve", path, format!("Unknown rule {entry}")))?;
            let run = self
                .heap
                .run_native_member(&url, graph, &member, &input)
                .map_err(|failure| error("execute", path, failure.to_string()))?;
            let diagnostics = diagnostics::map_runtime_diagnostics(
                run.diagnostics,
                source,
                "CLI_COMPILE_PARSE_RECOVERED",
                "CLI_COMPILE_PARSE_FAILURE",
                "compile",
            )
            .map_err(|failure| error("output", path, failure.to_string()))?;
            if !diagnostics.is_empty() {
                return Err(LanguageError {
                    phase: "compile",
                    module_url: url.to_string(),
                    message: diagnostics
                        .iter()
                        .map(|diagnostic| diagnostic.message.as_str())
                        .collect::<Vec<_>>()
                        .join("\n"),
                    diagnostics,
                });
            }
            input = run.value.ok_or_else(|| {
                error(
                    "output",
                    path,
                    "Language rule did not produce a native AST value".into(),
                )
            })?;
        }
        Ok(input)
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
        let (syntax, metadata) = self.execute_url_with_metadata(
            &url,
            entry,
            Value::String(source.into()),
            InputMode::Scalar,
        )?;
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
        let value = self.execute_url(&module, name, syntax, InputMode::Scalar)?;
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
                    let keys = object
                        .entries()
                        .iter()
                        .map(|(key, _)| {
                            key.as_string()
                                .ok_or_else(|| "Non-string data AST key".to_owned())?
                                .to_utf8()
                                .map_err(|failure| failure.to_string())
                        })
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
    // req:uffda-runtime-compilation-008
    fn native_compiler_keeps_undefined_fields_and_owned_results_across_heap_reuse() {
        let mut languages = Languages::new().unwrap();
        let declaration = languages
            .compile_source_native("export Main;\nrule Main = any;")
            .unwrap();
        let source = declaration
            .encode(false, crate::codec::data::DataLimits::default())
            .unwrap();
        assert!(source.contains("name:\"Main\""), "{source}");
        assert!(source.contains("expression:undefined"), "{source}");
        let next = languages
            .compile_source_native("export Other;\nrule Other = \"x\";")
            .unwrap();
        assert!(
            next.encode(false, crate::codec::data::DataLimits::default())
                .unwrap()
                .contains("name:\"Other\"")
        );
        assert_eq!(
            declaration
                .encode(false, crate::codec::data::DataLimits::default())
                .unwrap(),
            source
        );
    }

    #[test]
    // req:uffda-runtime-compilation-008
    fn native_compiler_reports_recovery_and_remains_usable_after_failure() {
        let mut languages = Languages::new().unwrap();
        let error = languages
            .compile_source_native("export Main;\nrule Main = any")
            .unwrap_err();
        assert!(!error.diagnostics.is_empty());
        assert!(error.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "CLI_STREAM_PARSE_RECOVERED"
                && diagnostic.message.contains("A declaration ends with")
        }));
        assert!(languages.compile_source_native("rule Main = (").is_err());
        assert!(languages.compile_source_native("rule Main = any;").is_ok());
    }

    #[test]
    // req:uffda-runtime-compilation-008 req:cli-bootstrap-034
    fn native_compiler_recompiles_all_authored_languages_as_codec_documents() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let mut pending = vec![root.join("src/lang")];
        let mut sources = Vec::new();
        while let Some(directory) = pending.pop() {
            for entry in std::fs::read_dir(directory).unwrap() {
                let entry = entry.unwrap();
                if entry.file_type().unwrap().is_dir() {
                    pending.push(entry.path());
                } else if entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension == "uff")
                {
                    sources.push(entry.path());
                }
            }
        }
        sources.sort();
        assert_eq!(sources.len(), crate::builtins::DECLARATIONS.len());
        assert!(sources.len() >= 70);
        let mut languages = Languages::new().unwrap();
        for path in sources {
            let source = std::fs::read_to_string(&path).unwrap();
            let declaration = languages
                .compile_source_native(&source)
                .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
            let encoded = declaration
                .encode(false, crate::codec::data::DataLimits::default())
                .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
            let decoded = crate::codec::data::DataDocument::from_codec(&encoded).unwrap();
            assert_eq!(
                decoded
                    .encode(false, crate::codec::data::DataLimits::default())
                    .unwrap(),
                encoded,
                "{}",
                path.display(),
            );
        }
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
    // req:cli-language-server-002
    fn extension_of_and_language_for_document_match_by_lowercase_extension() {
        assert_eq!(
            extension_of("file:///tmp/a.CUSTOM?x=1").as_deref(),
            Some(".custom")
        );
        assert_eq!(extension_of("notes"), None);
        let languages = vec![ProjectLanguage {
            id: "custom".into(),
            name: Some("Custom".into()),
            description: None,
            extensions: vec![".custom".into()],
            module: Url::parse("file:///tmp/custom.uff").unwrap(),
            entry: "Custom".into(),
            formatter: None,
            toggle_comment: None,
            specifier: Some("./custom.uff".into()),
        }];
        assert_eq!(
            language_for_document(&languages, "file:///tmp/a.custom")
                .map(|language| language.id.as_str()),
            Some("custom")
        );
        assert!(language_for_document(&languages, "file:///tmp/a.uff").is_none());
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

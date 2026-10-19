//! MCP session manager: open/close/load/eval/describe/query/patch/walk.

use crate::diagnostics::SourceDiagnostic;
use crate::evaluate::Evaluation;
use crate::expression::Expression;
use crate::languages::{Language, Languages};
use crate::module::{CompiledModuleGraph, ModuleBindings};
use crate::pattern::MatchKind;
use crate::project::Project;
use crate::resolver::graph::{MemberKind, ResolvedModule};
use crate::resolver::{ModuleDeclaration, Resolver, decode_declaration};
use crate::runtime::{InputMode, Runtime};
use serde_json::{Value, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;
use url::Url;

use super::ops::{self, MatchResults};

pub struct SessionManager {
    sessions: HashMap<String, Session>,
    next_id: u64,
}

pub struct Session {
    pub id: String,
    pub cwd: PathBuf,
    /// Optional JSR package cache (e.g. editor extension storage). When
    /// absent, package resolution uses the process default cache home.
    cache_dir: Option<PathBuf>,
    project: Option<Project>,
    pub languages: Languages,
    /// href → ModuleDeclaration JSON (committed successful loads).
    declarations: HashMap<Url, String>,
    module_order: Vec<Url>,
    last_loaded: Option<Url>,
    sources: HashMap<Url, String>,
    match_results: MatchResults,
    next_anonymous: u64,
    next_match_result_id: u64,
    closed: bool,
    /// Compiled graphs by entry module, dropped whenever a load commits.
    graph_cache: RefCell<HashMap<Url, Rc<CompiledModuleGraph>>>,
    /// Decorator-computed metadata by in-scope name, per module; dropped
    /// whenever a load commits.
    metadata_cache: RefCell<HashMap<Url, Rc<HashMap<String, Value>>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            next_id: 0,
        }
    }

    pub fn open(
        &mut self,
        cwd: PathBuf,
        config: Option<&str>,
    ) -> Result<&Session, SessionOpenError> {
        self.open_with_cache(cwd, config, None)
    }

    pub fn open_with_cache(
        &mut self,
        cwd: PathBuf,
        config: Option<&str>,
        cache_dir: Option<PathBuf>,
    ) -> Result<&Session, SessionOpenError> {
        let mut languages = Languages::new().map_err(|error| SessionOpenError {
            message: error.to_string(),
        })?;
        let project = match Project::discover(&cwd, config) {
            Ok(Some(path)) => {
                Some(
                    Project::load(path, &mut languages).map_err(|error| SessionOpenError {
                        message: error.to_string(),
                    })?,
                )
            }
            Ok(None) => None,
            Err(error) => {
                return Err(SessionOpenError {
                    message: error.to_string(),
                });
            }
        };
        if let Some(project) = &project {
            languages = project
                .resolver_with_cache(cache_dir.as_deref())
                .map_err(|error| SessionOpenError {
                    message: error.to_string(),
                })
                .and_then(|resolver| {
                    Languages::with_resolver(resolver).map_err(|error| SessionOpenError {
                        message: error.to_string(),
                    })
                })?;
        }
        Ok(self.insert_session(cwd, cache_dir, project, languages))
    }

    /// Open a session that ignores an invalid project file and serves the
    /// built-in `.uff` language (LSP req:cli-language-server-002).
    pub fn open_lenient(
        &mut self,
        cwd: PathBuf,
        cache_dir: Option<PathBuf>,
    ) -> Result<&Session, SessionOpenError> {
        let id = match self.open_with_cache(cwd.clone(), None, cache_dir.clone()) {
            Ok(session) => session.id.clone(),
            Err(error) => {
                eprintln!(
                    "uffda lsp: project not loaded ({}); serving .uff only",
                    error.message
                );
                let languages = Languages::new().map_err(|error| SessionOpenError {
                    message: error.to_string(),
                })?;
                return Ok(self.insert_session(cwd, cache_dir, None, languages));
            }
        };
        Ok(self.sessions.get(&id).expect("just opened"))
    }

    fn insert_session(
        &mut self,
        cwd: PathBuf,
        cache_dir: Option<PathBuf>,
        project: Option<Project>,
        languages: Languages,
    ) -> &Session {
        self.next_id += 1;
        let id = format!("session-{}", self.next_id);
        self.sessions.insert(
            id.clone(),
            Session {
                id: id.clone(),
                cwd,
                cache_dir,
                project,
                languages,
                declarations: HashMap::new(),
                module_order: Vec::new(),
                last_loaded: None,
                sources: HashMap::new(),
                match_results: HashMap::new(),
                next_anonymous: 0,
                next_match_result_id: 0,
                closed: false,
                graph_cache: RefCell::new(HashMap::new()),
                metadata_cache: RefCell::new(HashMap::new()),
            },
        );
        self.sessions.get(&id).expect("just inserted")
    }

    pub fn get_mut(&mut self, id: &str) -> Result<&mut Session, SessionLookupError> {
        match self.sessions.get_mut(id) {
            Some(session) if !session.closed => Ok(session),
            _ => Err(SessionLookupError {
                message: format!("No open session with id '{id}'"),
            }),
        }
    }

    pub fn close(&mut self, id: &str) -> Result<&Session, SessionLookupError> {
        match self.sessions.get_mut(id) {
            Some(session) if !session.closed => {
                session.closed = true;
                Ok(self.sessions.get(id).expect("present"))
            }
            _ => Err(SessionLookupError {
                message: format!("No open session with id '{id}'"),
            }),
        }
    }
}

impl Session {
    pub fn project(&self) -> Option<&Project> {
        self.project.as_ref()
    }

    pub fn load(&mut self, source: &str, path: Option<&str>) -> Value {
        self.load_at(source, path, None)
    }

    /// Like [`Session::load`], but reuses an AST already produced by
    /// `Languages::analyze` so the buffer is not parsed twice.
    pub fn load_syntax(
        &mut self,
        source: &str,
        syntax: crate::json::JsonValue,
        path: Option<&str>,
    ) -> Value {
        let module_url = match self.module_url_for(path) {
            Ok(url) => url,
            Err(message) => {
                return load_failure(
                    "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
                    "resolve",
                    message,
                    self.list_loaded_modules(),
                    vec![],
                );
            }
        };
        self.commit_loaded(source, module_url, syntax)
    }

    pub fn load_at(
        &mut self,
        source: &str,
        path: Option<&str>,
        explicit_url: Option<Url>,
    ) -> Value {
        let module_url = match explicit_url {
            Some(url) => url,
            None => match self.module_url_for(path) {
                Ok(url) => url,
                Err(message) => {
                    return load_failure(
                        "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
                        "resolve",
                        message,
                        self.list_loaded_modules(),
                        vec![],
                    );
                }
            },
        };

        let parsed = match self.languages.parse_source(source, Language::Uffda) {
            Ok(parsed) => parsed,
            Err(error) if !error.diagnostics.is_empty() => {
                return parse_failure(&error.diagnostics, self.list_loaded_modules());
            }
            Err(error) => {
                return load_failure(
                    "MCP_SESSION_LOAD_PARSE_FAILURE",
                    "parse",
                    error.to_string(),
                    self.list_loaded_modules(),
                    vec![],
                );
            }
        };
        if !parsed.diagnostics.is_empty() {
            return parse_failure(&parsed.diagnostics, self.list_loaded_modules());
        }

        self.commit_loaded(source, module_url, parsed.value)
    }

    fn commit_loaded(
        &mut self,
        source: &str,
        module_url: Url,
        syntax: crate::json::JsonValue,
    ) -> Value {
        let compiled = match self.languages.compile(syntax) {
            Ok(value) => value,
            Err(error) => {
                return load_failure(
                    "MCP_SESSION_LOAD_COMPILE_FAILURE",
                    "compile",
                    error.to_string(),
                    self.list_loaded_modules(),
                    vec![],
                );
            }
        };
        let declaration_json = compiled.to_string();
        let declaration = match decode_declaration(&module_url, &declaration_json) {
            Ok(declaration) => declaration,
            Err(error) => {
                return load_failure(
                    "MCP_SESSION_LOAD_COMPILE_FAILURE",
                    "compile",
                    error.to_string(),
                    self.list_loaded_modules(),
                    vec![],
                );
            }
        };

        let exclude: std::collections::HashSet<String> = self
            .module_order
            .iter()
            .map(|url| url.as_str().to_string())
            .chain(std::iter::once(module_url.as_str().to_string()))
            .collect();

        let mut resolver = match self.make_resolver() {
            Ok(resolver) => resolver,
            Err(message) => {
                return load_failure(
                    "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
                    "resolve",
                    message,
                    self.list_loaded_modules(),
                    vec![],
                );
            }
        };
        for (url, json) in &self.declarations {
            match decode_declaration(url, json) {
                Ok(existing) => resolver.insert_declaration(url.clone(), existing),
                Err(error) => {
                    return load_failure(
                        "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
                        "resolve",
                        error.to_string(),
                        self.list_loaded_modules(),
                        vec![],
                    );
                }
            }
        }
        resolver.insert_declaration(module_url.clone(), declaration);

        let graph = match resolver.load_graph(&module_url) {
            Ok(graph) => graph,
            Err(error) => {
                let resolved = collect_resolved_during_load(&resolver, &exclude);
                return load_failure(
                    "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
                    "resolve",
                    error.to_string(),
                    self.list_loaded_modules(),
                    resolved,
                );
            }
        };

        // Commit every module the resolver reached (root + transitive imports).
        self.graph_cache.borrow_mut().clear();
        self.metadata_cache.borrow_mut().clear();
        for (url, module) in &graph.modules {
            let json = serialize_declaration(&module.declaration);
            self.declarations.insert(url.clone(), json);
            if !self.module_order.iter().any(|existing| existing == url) {
                self.module_order.push(url.clone());
            }
        }
        self.sources.insert(module_url.clone(), source.to_string());
        self.last_loaded = Some(module_url.clone());

        let summary = summarize_resolved(&module_url, &graph.modules[&graph.entry]);
        json!({ "ok": true, "module": summary })
    }

    pub fn list_loaded_modules(&self) -> Vec<Value> {
        self.module_order
            .iter()
            .filter_map(|url| {
                let json = self.declarations.get(url)?;
                let declaration = decode_declaration(url, json).ok()?;
                Some(summarize_declaration(url, &declaration))
            })
            .collect()
    }

    pub fn eval(
        &mut self,
        module_url: Option<&str>,
        expression: Option<&str>,
        rule: Option<&str>,
        input: Option<&str>,
        input_is_json: bool,
    ) -> Value {
        let has_expression = expression.is_some();
        let has_rule = rule.is_some();
        if has_expression == has_rule {
            return eval_failure(
                "MCP_SESSION_EVAL_INVALID_INPUT",
                "input",
                "Provide exactly one of `expression` or `rule`.",
            );
        }
        let target = match self.resolve_target_module(module_url) {
            Ok(url) => url,
            Err(error) => return error,
        };
        let (graph, _) = match self.compiled_graph() {
            Ok(graph) => graph,
            Err(message) => {
                return eval_failure("MCP_SESSION_EVAL_UNKNOWN_MODULE", "resolve", message);
            }
        };

        if let Some(expression_source) = expression {
            return self.eval_expression(&graph, &target, expression_source);
        }

        let Some(rule_name) = rule else {
            return eval_failure(
                "MCP_SESSION_EVAL_INVALID_INPUT",
                "input",
                "Provide exactly one of `expression` or `rule`.",
            );
        };
        let Some(input) = input else {
            return eval_failure(
                "MCP_SESSION_EVAL_INVALID_INPUT",
                "input",
                "`input` is required when `rule` is set.",
            );
        };
        self.eval_rule(&graph, &target, rule_name, input, input_is_json)
    }

    fn eval_expression(
        &mut self,
        graph: &Rc<CompiledModuleGraph>,
        module: &Url,
        expression_source: &str,
    ) -> Value {
        let parsed = match self
            .languages
            .parse_source(expression_source, Language::Expression)
        {
            Ok(parsed) if parsed.diagnostics.is_empty() => parsed,
            Ok(parsed) => {
                return eval_parse_failure(&parsed.diagnostics);
            }
            Err(error) if !error.diagnostics.is_empty() => {
                return eval_parse_failure(&error.diagnostics);
            }
            Err(error) => {
                return eval_failure("MCP_SESSION_EVAL_PARSE_FAILURE", "parse", error.to_string());
            }
        };
        let expression: Expression = match crate::json::from_value(parsed.value) {
            Ok(expression) => expression,
            Err(error) => {
                return eval_failure("MCP_SESSION_EVAL_PARSE_FAILURE", "parse", error.to_string());
            }
        };
        let module = module.clone();
        let graph = Rc::clone(graph);
        let mut evaluation = Evaluation::with_environment(expression, move |mc| {
            match ModuleBindings::new(mc, &graph).and_then(|bindings| {
                bindings
                    .environment(&module)
                    .ok_or_else(|| format!("No module environment for {module}"))
            }) {
                Ok(environment) => environment,
                Err(message) => {
                    // Fall back to an empty environment; finish() will surface
                    // unknown references rather than panicking in the arena ctor.
                    let _ = message;
                    crate::environment::Environment::new(mc, None, vec![])
                }
            }
        });
        let rooted = match evaluation.finish() {
            Ok(value) => value,
            Err(error) => {
                return eval_failure(
                    "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                    "eval",
                    error.to_string(),
                );
            }
        };
        match evaluation.serialize_rooted(&rooted) {
            Ok(serialized) => {
                match evaluation.read(&serialized, crate::output::serialized_output) {
                    Ok(Ok(text)) => json!({ "ok": true, "value": json_value_from_output(&text) }),
                    Ok(Err(error)) => eval_failure(
                        "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                        "eval",
                        error.to_string(),
                    ),
                    Err(error) => eval_failure(
                        "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                        "eval",
                        error.to_string(),
                    ),
                }
            }
            Err(error) => eval_failure(
                "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                "eval",
                error.to_string(),
            ),
        }
    }

    fn eval_rule(
        &mut self,
        graph: &Rc<CompiledModuleGraph>,
        module: &Url,
        rule: &str,
        input: &str,
        input_is_json: bool,
    ) -> Value {
        let subject = if input_is_json {
            match crate::json::from_str(input) {
                Ok(value) => value,
                Err(error) => {
                    return eval_failure(
                        "MCP_SESSION_EVAL_INVALID_JSON",
                        "input",
                        error.to_string(),
                    );
                }
            }
        } else {
            crate::json::JsonValue::String(input.into())
        };
        let mode = if input_is_json {
            InputMode::Scalar
        } else {
            InputMode::Iterable
        };
        let mut runtime =
            match Runtime::with_mode(Rc::clone(graph), module, Some(rule), subject, mode) {
                Ok(runtime) => runtime,
                Err(error) => {
                    return eval_failure(
                        "MCP_SESSION_EVAL_MATCH_FAILURE",
                        "eval",
                        error.to_string(),
                    );
                }
            };
        if let Err(error) = runtime.run() {
            return eval_failure(
                "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                "eval",
                error.to_string(),
            );
        }
        let failed = runtime.read(|execution| {
            execution
                .result()
                .is_some_and(|result| result.kind == MatchKind::Fail)
        });
        if failed {
            return eval_failure(
                "MCP_SESSION_EVAL_MATCH_FAILURE",
                "eval",
                format!("Rule '{rule}' did not match"),
            );
        }
        let text = match runtime.serialize_result() {
            Ok(text) => text,
            Err(error) => {
                return eval_failure(
                    "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
                    "eval",
                    error.to_string(),
                );
            }
        };
        self.next_match_result_id += 1;
        let match_result_id = self.next_match_result_id.to_string();
        if let Some(tree) = ops::project_match_tree(&runtime) {
            self.match_results.insert(match_result_id.clone(), tree);
        }
        json!({
            "ok": true,
            "value": json_value_from_output(text.as_deref().unwrap_or("undefined")),
            "matchResultId": match_result_id
        })
    }

    pub fn describe(&self, name: &str, module_url: Option<&str>) -> Value {
        let target = match self.resolve_target_module(module_url) {
            Ok(url) => url,
            Err(error) => {
                return json!({
                    "ok": false,
                    "error": {
                        "code": "MCP_SESSION_DESCRIBE_UNKNOWN_MODULE",
                        "phase": "resolve",
                        "message": error["error"]["message"].as_str().unwrap_or("unknown module")
                    }
                });
            }
        };
        let Some(declaration_json) = self.declarations.get(&target) else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_DESCRIBE_UNKNOWN_MODULE",
                    "phase": "resolve",
                    "message": format!("No module loaded with url: {target}")
                }
            });
        };
        let Ok(graph) = self.compiled_graph_for(&target) else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_DESCRIBE_UNKNOWN_MODULE",
                    "phase": "resolve",
                    "message": "Unable to compile session module graph"
                }
            });
        };
        ops::describe_declaration(&graph, &target, name, declaration_json)
    }

    pub fn query(&self, decorator: &str, predicate: Option<&str>) -> Value {
        let Ok((graph, _)) = self.compiled_graph() else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_QUERY_PARSE_FAILURE",
                    "phase": "resolve",
                    "message": "Unable to compile session module graph"
                }
            });
        };
        let modules: Vec<(Url, String)> = self
            .module_order
            .iter()
            .filter_map(|url| {
                self.declarations
                    .get(url)
                    .map(|json| (url.clone(), json.clone()))
            })
            .collect();
        ops::query_by_metadata(&graph, &modules, decorator, predicate)
    }

    pub fn patch(
        &mut self,
        module_url: Option<&str>,
        start: usize,
        end: usize,
        replacement: &str,
    ) -> Value {
        let target = match self.resolve_target_module(module_url) {
            Ok(url) => url,
            Err(_) => {
                return json!({
                    "ok": false,
                    "error": {
                        "code": "MCP_SESSION_PATCH_UNKNOWN_MODULE",
                        "phase": "input",
                        "message": "This session has no loaded modules to patch"
                    },
                    "partiallyLoadedModules": self.list_loaded_modules(),
                    "resolvedDuringLoad": []
                });
            }
        };
        let Some(source) = self.sources.get(&target).cloned() else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_PATCH_UNKNOWN_MODULE",
                    "phase": "input",
                    "message": format!("No prior parse state retained for module: {target}")
                },
                "partiallyLoadedModules": self.list_loaded_modules(),
                "resolvedDuringLoad": []
            });
        };
        let units: Vec<u16> = source.encode_utf16().collect();
        if end < start || end > units.len() {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_PATCH_INVALID_EDIT",
                    "phase": "input",
                    "message": format!(
                        "Invalid edit range [{start}, {end}) for module source of length {}",
                        units.len()
                    )
                },
                "partiallyLoadedModules": self.list_loaded_modules(),
                "resolvedDuringLoad": []
            });
        }
        let mut new_units = units[..start].to_vec();
        new_units.extend(replacement.encode_utf16());
        new_units.extend_from_slice(&units[end..]);
        let new_source = String::from_utf16_lossy(&new_units);
        let path = target.to_file_path().ok().and_then(|path| {
            path.strip_prefix(&self.cwd)
                .ok()
                .map(|path| path.display().to_string())
        });
        self.load_at(&new_source, path.as_deref(), Some(target))
    }

    /// Retained match tree for `match_result_id`, when the session still holds it.
    pub fn retained_match(&self, match_result_id: &str) -> Option<&ops::RetainedMatch> {
        self.match_results.get(match_result_id)
    }

    pub fn walk(
        &self,
        match_result_id: &str,
        path: Option<&[usize]>,
        max_nodes: Option<usize>,
        max_depth: Option<usize>,
    ) -> Value {
        let Some(root) = self.match_results.get(match_result_id) else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_WALK_UNKNOWN_MATCH_RESULT",
                    "phase": "input",
                    "message": format!("No retained match result with id '{match_result_id}'")
                }
            });
        };
        ops::walk_retained(
            root,
            path.unwrap_or(&[]),
            max_nodes.unwrap_or(50),
            max_depth,
        )
    }

    fn resolve_target_module(&self, module_url: Option<&str>) -> Result<Url, Value> {
        if let Some(module_url) = module_url {
            if let Ok(url) = Url::parse(module_url)
                && self.declarations.contains_key(&url)
            {
                return Ok(url);
            }
            let absolute = self.cwd.join(module_url);
            if let Ok(url) = Url::from_file_path(&absolute)
                && self.declarations.contains_key(&url)
            {
                return Ok(url);
            }
            return Err(eval_failure(
                "MCP_SESSION_EVAL_UNKNOWN_MODULE",
                "resolve",
                format!("No module loaded in this session with url: {module_url}"),
            ));
        }
        self.last_loaded.clone().ok_or_else(|| {
            eval_failure(
                "MCP_SESSION_EVAL_UNKNOWN_MODULE",
                "resolve",
                "This session has no loaded modules to evaluate against",
            )
        })
    }

    fn compiled_graph(&self) -> Result<(Rc<CompiledModuleGraph>, Url), String> {
        let entry = self
            .last_loaded
            .clone()
            .ok_or_else(|| "This session has no loaded modules".to_string())?;
        let graph = self.compiled_graph_for(&entry)?;
        Ok((graph, entry))
    }

    /// The compiled graph rooted at the loaded module `entry`, cached until the
    /// next load commits.
    pub fn compiled_graph_for(&self, entry: &Url) -> Result<Rc<CompiledModuleGraph>, String> {
        if let Some(graph) = self.graph_cache.borrow().get(entry) {
            return Ok(Rc::clone(graph));
        }
        if !self.declarations.contains_key(entry) {
            return Err(format!("No module loaded with url: {entry}"));
        }
        let mut resolver = self.make_resolver()?;
        for (url, json) in &self.declarations {
            let declaration = decode_declaration(url, json).map_err(|error| error.to_string())?;
            resolver.insert_declaration(url.clone(), declaration);
        }
        let graph = resolver
            .load_graph(entry)
            .map_err(|error| error.to_string())?;
        let compiled =
            Rc::new(CompiledModuleGraph::compile(graph).map_err(|error| error.to_string())?);
        self.graph_cache
            .borrow_mut()
            .insert(entry.clone(), Rc::clone(&compiled));
        Ok(compiled)
    }

    fn module_url_for(&mut self, path: Option<&str>) -> Result<Url, String> {
        match path {
            Some(path) => {
                let absolute = self.cwd.join(path);
                Url::from_file_path(&absolute)
                    .map_err(|()| format!("Invalid module path: {}", absolute.display()))
            }
            None => {
                self.next_anonymous += 1;
                Url::parse(&format!(
                    "session:///{}/{}.uff",
                    self.id, self.next_anonymous
                ))
                .map_err(|error| error.to_string())
            }
        }
    }

    fn make_resolver(&self) -> Result<Resolver, String> {
        match &self.project {
            Some(project) => project
                .resolver_with_cache(self.cache_dir.as_deref())
                .map_err(|error| error.to_string()),
            None => {
                let mut resolver = Resolver::new(self.cwd.clone(), self.cwd.join("bin"))
                    .map_err(|error| error.to_string())?;
                if let Some(cache_dir) = &self.cache_dir {
                    let lockfile = crate::resolver::packages::Lockfile::memory();
                    let packages = crate::resolver::packages::JsrPackages::new(
                        Url::parse("https://jsr.io/").map_err(|error| error.to_string())?,
                        cache_dir.clone(),
                        Rc::new(crate::resolver::packages::HttpTransport),
                        lockfile,
                    )?;
                    resolver.set_packages(packages);
                }
                Ok(resolver)
            }
        }
    }
}

/// A rule/func/decorator name in scope of a loaded module.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeclarationSummary {
    pub name: String,
    pub kind: &'static str,
    pub exported: bool,
}

/// The module that defines a name in scope of a loaded module.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedDeclaration {
    pub defining_module_url: Url,
    pub kind: &'static str,
    pub name: String,
}

/// Read-only editor queries over a session's resolved state. None of these
/// loads, mutates, or writes anything.
impl Session {
    /// Whether `url` has been successfully loaded into this session.
    pub fn has_module(&self, url: &Url) -> bool {
        self.declarations.contains_key(url)
    }

    /// Whether the session's retained source for `url` is exactly `source`.
    pub fn source_matches(&self, url: &Url, source: &str) -> bool {
        self.sources.get(url).is_some_and(|text| text == source)
    }

    /// Module URLs this loaded module imports (`imports[].moduleUrl`), resolved
    /// against `module_url`. Empty when the module is not loaded or has no
    /// imports.
    pub fn import_module_urls(&self, module_url: &Url) -> Vec<Url> {
        let Some(json) = self.declarations.get(module_url) else {
            return Vec::new();
        };
        let Ok(declaration) = decode_declaration(module_url, json) else {
            return Vec::new();
        };
        let mut urls = Vec::new();
        for import in &declaration.imports {
            let Some(path) = import.get("moduleUrl").and_then(|value| match value {
                crate::json::JsonValue::String(text) => text.to_utf8().ok(),
                _ => None,
            }) else {
                continue;
            };
            if let Ok(url) = module_url.join(&path) {
                urls.push(url);
            }
        }
        urls
    }

    /// Resolves `name` in scope of the loaded module `module_url` (its own
    /// declarations first, then names its imports bind) to the module that
    /// defines it, following imports.
    pub fn resolve_declaration(&self, name: &str, module_url: &Url) -> Option<ResolvedDeclaration> {
        let graph = self.compiled_graph_for(module_url).ok()?;
        let member = graph
            .resolve(module_url, name)
            .or_else(|| graph.resolve_decorator(module_url, name))?;
        Some(ResolvedDeclaration {
            defining_module_url: member.module_url,
            kind: member_kind_name(member.kind),
            name: name.to_string(),
        })
    }

    /// The decorator-computed metadata (as `describe` reports it) of every rule
    /// and func in scope of the loaded module `module_url`, by name. One metadata
    /// run serves the whole table, so completion can document every item.
    pub fn metadata_table(&self, module_url: &Url) -> Option<Rc<HashMap<String, Value>>> {
        if let Some(table) = self.metadata_cache.borrow().get(module_url) {
            return Some(Rc::clone(table));
        }
        let graph = self.compiled_graph_for(module_url).ok()?;
        let module = graph.graph.modules.get(module_url)?;
        let mut runtime = Runtime::metadata(Rc::clone(&graph)).ok()?;
        runtime.run().ok()?;
        let mut table = HashMap::new();
        for (name, member) in module.locals.iter().chain(module.imports.iter()) {
            if member.kind == MemberKind::Decorator || table.contains_key(name) {
                continue;
            }
            let Some(text) = runtime.serialize_metadata(member).ok().flatten() else {
                continue;
            };
            if let Ok(metadata) = serde_json::from_str::<Value>(text.trim()) {
                table.insert(name.clone(), metadata);
            }
        }
        let table = Rc::new(table);
        self.metadata_cache
            .borrow_mut()
            .insert(module_url.clone(), Rc::clone(&table));
        Some(table)
    }

    /// Every declaration in scope of the loaded module `module_url`: its own,
    /// then those its imports bind.
    pub fn list_declarations(&self, module_url: &Url) -> Option<Vec<DeclarationSummary>> {
        let graph = self.compiled_graph_for(module_url).ok()?;
        let module = graph.graph.modules.get(module_url)?;
        let mut declarations = Vec::new();
        for (name, member) in module.locals.iter().chain(module.imports.iter()) {
            declarations.push(DeclarationSummary {
                name: name.clone(),
                kind: member_kind_name(member.kind),
                exported: module.exports.contains_key(name),
            });
        }
        Some(declarations)
    }

    /// The names a loaded module exports.
    pub fn list_exports(&self, module_url: &Url) -> Option<Vec<DeclarationSummary>> {
        Some(
            self.list_declarations(module_url)?
                .into_iter()
                .filter(|declaration| declaration.exported)
                .collect(),
        )
    }

    /// The exports of module `source` read without loading it into the
    /// session and without writing artifacts: `(name, kind)` pairs, `None` when
    /// the source does not parse and lower cleanly.
    pub fn exports_from_source(&mut self, source: &str) -> Option<Vec<(String, String)>> {
        let parsed = self.languages.parse_source(source, Language::Uffda).ok()?;
        if !parsed.diagnostics.is_empty() {
            return None;
        }
        let compiled = self.languages.compile(parsed.value).ok()?;
        let crate::json::JsonValue::Array(exports) = compiled.get("exports")? else {
            return None;
        };
        Some(
            exports
                .iter()
                .filter_map(|export| {
                    let name = match export.get("name")? {
                        crate::json::JsonValue::String(text) => text.to_utf8().ok()?,
                        _ => return None,
                    };
                    let kind = match export.get("kind") {
                        Some(crate::json::JsonValue::String(text)) => text.to_utf8().ok()?,
                        _ => "rule".to_string(),
                    };
                    Some((name, kind))
                })
                .collect(),
        )
    }
}

fn serialize_declaration(declaration: &ModuleDeclaration) -> String {
    // Re-encode via serde_json for a stable round-trip string.
    serde_json::to_string(&json!({
        "imports": declaration.imports.iter().map(json_from_runtime).collect::<Vec<_>>(),
        "exports": declaration.exports.iter().map(json_from_runtime).collect::<Vec<_>>(),
        "rules": declaration.rules.iter().map(json_from_runtime).collect::<Vec<_>>(),
        "funcs": declaration.funcs.iter().map(json_from_runtime).collect::<Vec<_>>(),
        "decorators": declaration.decorators.iter().map(json_from_runtime).collect::<Vec<_>>(),
    }))
    .unwrap_or_else(|_| {
        r#"{"imports":[],"exports":[],"rules":[],"funcs":[],"decorators":[]}"#.to_string()
    })
}

fn json_from_runtime(value: &crate::json::JsonValue) -> Value {
    serde_json::from_str(&value.to_string()).unwrap_or(Value::Null)
}

fn summarize_resolved(module_url: &Url, module: &ResolvedModule) -> Value {
    let mut declarations = Vec::new();
    let mut push = |name: &str, kind: MemberKind, exported: bool| {
        declarations.push(json!({
            "name": name,
            "kind": member_kind_name(kind),
            "exported": exported
        }));
    };
    for (name, member) in &module.locals {
        push(name, member.kind, module.exports.contains_key(name));
    }
    for (name, member) in &module.imports {
        push(name, member.kind, module.exports.contains_key(name));
    }
    json!({
        "moduleUrl": module_url.as_str(),
        "declarations": declarations
    })
}

fn summarize_declaration(module_url: &Url, declaration: &ModuleDeclaration) -> Value {
    let exported_names: std::collections::HashSet<String> = declaration
        .exports
        .iter()
        .filter_map(|export| {
            export.get("name").and_then(|v| match v {
                crate::json::JsonValue::String(s) => s.to_utf8().ok(),
                _ => None,
            })
        })
        .collect();
    let mut declarations = Vec::new();
    let mut push_all = |kind: &str, items: &[crate::json::JsonValue]| {
        for item in items {
            let Some(crate::json::JsonValue::String(name)) = item.get("name") else {
                continue;
            };
            let Ok(name) = name.to_utf8() else {
                continue;
            };
            declarations.push(json!({
                "name": name,
                "kind": kind,
                "exported": exported_names.contains(&name)
            }));
        }
    };
    push_all("rule", &declaration.rules);
    push_all("func", &declaration.funcs);
    push_all("decorator", &declaration.decorators);
    json!({
        "moduleUrl": module_url.as_str(),
        "declarations": declarations
    })
}

fn member_kind_name(kind: MemberKind) -> &'static str {
    match kind {
        MemberKind::Rule => "rule",
        MemberKind::Func => "func",
        MemberKind::Decorator => "decorator",
    }
}

fn collect_resolved_during_load(
    resolver: &Resolver,
    exclude: &std::collections::HashSet<String>,
) -> Vec<Value> {
    // Resolver does not currently expose a public resolved-modules snapshot on
    // failure; leave empty until that surface exists (matches Deno for
    // parse/compile failures).
    let _ = (resolver, exclude);
    Vec::new()
}

fn parse_failure(diagnostics: &[SourceDiagnostic], partially_loaded: Vec<Value>) -> Value {
    let mapped: Vec<Value> = diagnostics
        .iter()
        .map(|diagnostic| {
            let code = if matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery) {
                "MCP_SESSION_LOAD_PARSE_RECOVERED"
            } else {
                "MCP_SESSION_LOAD_PARSE_FAILURE"
            };
            json!({
                "code": code,
                "phase": "parse",
                "message": diagnostic.message,
                "location": {
                    "offset": diagnostic.location.offset,
                    "line": diagnostic.location.line,
                    "column": diagnostic.location.column,
                }
            })
        })
        .collect();
    let error = mapped.first().cloned().unwrap_or_else(|| {
        json!({
            "code": "MCP_SESSION_LOAD_PARSE_FAILURE",
            "phase": "parse",
            "message": "parse failed"
        })
    });
    json!({
        "ok": false,
        "error": error,
        "diagnostics": mapped,
        "partiallyLoadedModules": partially_loaded,
        "resolvedDuringLoad": []
    })
}

fn load_failure(
    code: &str,
    phase: &str,
    message: impl Into<String>,
    partially_loaded: Vec<Value>,
    resolved_during_load: Vec<Value>,
) -> Value {
    json!({
        "ok": false,
        "error": {
            "code": code,
            "phase": phase,
            "message": message.into()
        },
        "partiallyLoadedModules": partially_loaded,
        "resolvedDuringLoad": resolved_during_load
    })
}

fn json_value_from_output(text: &str) -> Value {
    let trimmed = text.trim();
    if trimmed == "undefined" {
        return Value::Null;
    }
    serde_json::from_str(trimmed).unwrap_or_else(|_| Value::String(trimmed.to_string()))
}

fn eval_failure(code: &str, phase: &str, message: impl Into<String>) -> Value {
    json!({
        "ok": false,
        "error": {
            "code": code,
            "phase": phase,
            "message": message.into()
        }
    })
}

fn eval_parse_failure(diagnostics: &[SourceDiagnostic]) -> Value {
    let mapped: Vec<Value> = diagnostics
        .iter()
        .map(|diagnostic| {
            let code = if matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery) {
                "MCP_SESSION_EVAL_RECOVERED"
            } else {
                "MCP_SESSION_EVAL_PARSE_FAILURE"
            };
            json!({
                "code": code,
                "phase": "parse",
                "message": diagnostic.message
            })
        })
        .collect();
    let error = mapped.first().cloned().unwrap_or_else(|| {
        json!({
            "code": "MCP_SESSION_EVAL_PARSE_FAILURE",
            "phase": "parse",
            "message": "parse failed"
        })
    });
    json!({ "ok": false, "error": error, "diagnostics": mapped })
}

#[derive(Debug)]
pub struct SessionOpenError {
    pub message: String,
}

#[derive(Debug)]
pub struct SessionLookupError {
    pub message: String,
}

pub fn session_tool_descriptors() -> Vec<Value> {
    vec![
        json!({
            "name": "uffda_session_open",
            "title": "uffda session open",
            "description": "Opens a new, empty live runtime session and returns its id. State loaded into one session is never visible to another.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "cwd": {
                        "type": "string",
                        "description": "Absolute working directory the session's imports/artifacts resolve against. Defaults to the server process's cwd."
                    },
                    "config": {
                        "type": "string",
                        "description": "Project file (uffda.jsonc) relative to cwd."
                    }
                },
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_load",
            "title": "uffda session load",
            "description": "Parses, compiles, and resolves source against a session's accumulated module graph, adding it (and any modules it imports).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "An id returned by uffda_session_open."
                    },
                    "source": {
                        "type": "string",
                        "description": "Uffda module source text to load."
                    },
                    "path": {
                        "type": "string",
                        "description": "Path (relative to the session's cwd) identifying this module."
                    }
                },
                "required": ["sessionId", "source"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_list_modules",
            "title": "uffda session list modules",
            "description": "Lists modules successfully loaded into a session, with their declaration summaries.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "An id returned by uffda_session_open."
                    }
                },
                "required": ["sessionId"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_eval",
            "title": "uffda session eval",
            "description": "Evaluates an expression or invokes a named rule against a loaded module in a session.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "An id returned by uffda_session_open."
                    },
                    "moduleUrl": {
                        "type": "string",
                        "description": "Which loaded module's scope to evaluate against. Defaults to the most recently loaded module."
                    },
                    "expression": {
                        "type": "string",
                        "description": "An Uffda expression to evaluate. Mutually exclusive with `rule`."
                    },
                    "rule": {
                        "type": "string",
                        "description": "The name of an exported Rule to invoke against `input`. Mutually exclusive with `expression`."
                    },
                    "input": {
                        "type": "string",
                        "description": "Subject text to match `rule` against. Required when `rule` is set."
                    },
                    "inputIsJson": {
                        "type": "boolean",
                        "description": "When true, `input` is parsed as JSON before matching. Defaults to false."
                    }
                },
                "required": ["sessionId"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_describe",
            "title": "uffda session describe",
            "description": "Describes a rule/func/decorator declaration from a session's resolved state.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "name": { "type": "string" },
                    "moduleUrl": { "type": "string" }
                },
                "required": ["sessionId", "name"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_query",
            "title": "uffda session query",
            "description": "Finds rules/funcs whose metadata contains an entry for a decorator.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "decorator": { "type": "string" },
                    "predicate": { "type": "string" }
                },
                "required": ["sessionId", "decorator"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_patch",
            "title": "uffda session patch",
            "description": "Applies a character-offset edit to a loaded module and re-parses/resolves it.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "moduleUrl": { "type": "string" },
                    "start": { "type": "integer", "minimum": 0 },
                    "end": { "type": "integer", "minimum": 0 },
                    "replacement": { "type": "string" }
                },
                "required": ["sessionId", "start", "end", "replacement"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_walk",
            "title": "uffda session walk",
            "description": "Traverses a retained match result tree from a prior uffda_session_eval rule invocation.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "matchResultId": { "type": "string" },
                    "path": { "type": "array", "items": { "type": "integer", "minimum": 0 } },
                    "maxNodes": { "type": "integer", "minimum": 1 },
                    "maxDepth": { "type": "integer", "minimum": 0 }
                },
                "required": ["sessionId", "matchResultId"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_close",
            "title": "uffda session close",
            "description": "Closes a live runtime session and releases its in-memory state.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "An id returned by uffda_session_open."
                    }
                },
                "required": ["sessionId"],
                "additionalProperties": false
            }
        }),
    ]
}

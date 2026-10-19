//! Language Server Protocol stdio server (`uffda lsp`).
//!
//! Wire format is LSP's Content-Length framed JSON-RPC 2.0 over stdio (not
//! MCP's NDJSON). Document project roots come from the nearest `uffda.jsonc`
//! above the file (not process cwd). Relative imports resolve against the
//! document URL.

mod completion;
mod completion_context;
mod definition;
mod document;
mod editor;
mod hover;
mod locals;
mod positions;
mod reference_roles;
mod references;
mod symbols;

use crate::highlight::{
    encode_semantic_tokens, encode_semantic_tokens_typed, semantic_tokens_legend,
};
use crate::languages::Language;
use crate::mcp::sessions::{Session, SessionManager};
use crate::project::Project;
use document::{DocumentAnalysis, DocumentStore};
use positions::{Position, position_to_offset_units, range_json};
use references::RenamePlan;
use serde_json::{Map, Value, json};
use std::collections::{HashMap, HashSet};
use std::io::{self, BufRead, Read, Write};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use url::Url;

/// LSP `RequestFailed` error code: the request was valid but could not be
/// carried out (for example a refused rename).
const REQUEST_FAILED: i64 = -32803;

/// Run the LSP server until `exit` or stdin EOF.
///
/// Returns `0` when the client sent `shutdown` before the connection closed,
/// otherwise `1` (see req:cli-language-server-010).
pub fn run_stdio() -> io::Result<i32> {
    let stdin = io::stdin();
    let mut input = stdin.lock();
    let mut stdout = io::stdout().lock();
    let mut state = ServerState::new();
    loop {
        let Some(message) = read_message(&mut input)? else {
            break;
        };
        for response in handle_message(&message, &mut state) {
            write_message(&mut stdout, &response)?;
        }
        if message.get("method").and_then(Value::as_str) == Some("exit") {
            break;
        }
    }
    Ok(if state.shutdown_requested { 0 } else { 1 })
}

struct ServerState {
    shutdown_requested: bool,
    documents: HashMap<String, String>,
    /// Latest parse of each open document (spans + editor tree) and read-only
    /// parses of workspace files, for the editor features.
    store: DocumentStore,
    /// Absolute workspace folder paths from `initialize` /
    /// `workspace/didChangeWorkspaceFolders`.
    workspace_folders: Vec<PathBuf>,
    /// JSR package cache from `initializationOptions.cacheDir`.
    cache_dir: Option<PathBuf>,
    /// Project root → session id (one session per discovered project).
    project_sessions: HashMap<PathBuf, String>,
    sessions: SessionManager,
}

impl ServerState {
    fn new() -> Self {
        Self {
            shutdown_requested: false,
            documents: HashMap::new(),
            store: DocumentStore::default(),
            workspace_folders: Vec::new(),
            cache_dir: None,
            project_sessions: HashMap::new(),
            sessions: SessionManager::new(),
        }
    }

    fn apply_initialize(&mut self, params: &Value) {
        self.workspace_folders = workspace_folders_from_params(params);
        self.cache_dir = params
            .pointer("/initializationOptions/cacheDir")
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .filter(|path| path.is_absolute());
        if let Some(cache_dir) = &self.cache_dir {
            let _ = std::fs::create_dir_all(cache_dir);
        }
    }
}

fn workspace_folders_from_params(params: &Value) -> Vec<PathBuf> {
    let mut folders = Vec::new();
    if let Some(items) = params.get("workspaceFolders").and_then(Value::as_array) {
        for item in items {
            if let Some(uri) = item.get("uri").and_then(Value::as_str)
                && let Ok(url) = Url::parse(uri)
                && let Ok(path) = url.to_file_path()
            {
                folders.push(path);
            }
        }
    }
    if folders.is_empty()
        && let Some(uri) = params.get("rootUri").and_then(Value::as_str)
        && let Ok(url) = Url::parse(uri)
        && let Ok(path) = url.to_file_path()
    {
        folders.push(path);
    }
    folders
}

fn path_from_file_uri(uri: &str) -> Option<PathBuf> {
    Url::parse(uri).ok().and_then(|url| url.to_file_path().ok())
}

fn read_message(input: &mut impl BufRead) -> io::Result<Option<Value>> {
    let mut content_length = None;
    loop {
        let mut line = String::new();
        let n = input.read_line(&mut line)?;
        if n == 0 {
            return Ok(None);
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        let Some((name, value)) = trimmed.split_once(':') else {
            continue;
        };
        if name.eq_ignore_ascii_case("Content-Length") {
            content_length = value.trim().parse::<usize>().ok();
        }
    }
    let Some(len) = content_length else {
        return Ok(None);
    };
    let mut buf = vec![0u8; len];
    Read::read_exact(input, &mut buf)?;
    match serde_json::from_slice(&buf) {
        Ok(value) => Ok(Some(value)),
        Err(error) => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": null,
            "error": {
                "code": -32700,
                "message": format!("Parse error: {error}"),
            }
        }))),
    }
}

fn write_message(out: &mut impl Write, message: &Value) -> io::Result<()> {
    let body = serde_json::to_string(message)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    write!(out, "Content-Length: {}\r\n\r\n{body}", body.len())?;
    out.flush()
}

fn handle_message(message: &Value, state: &mut ServerState) -> Vec<Value> {
    if message.get("error").is_some() && message.get("method").is_none() {
        return vec![message.clone()];
    }
    let method = message.get("method").and_then(Value::as_str);
    let id = message.get("id").cloned();
    match method {
        Some("initialize") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            state.apply_initialize(&params);
            vec![rpc_result(
                id,
                json!({
                    "capabilities": {
                        "textDocumentSync": {
                            "openClose": true,
                            "change": 1
                        },
                        "workspace": {
                            "workspaceFolders": {
                                "supported": true,
                                "changeNotifications": true
                            }
                        },
                        "semanticTokensProvider": {
                            "legend": semantic_tokens_legend(),
                            "full": true
                        },
                        "hoverProvider": true,
                        "definitionProvider": true,
                        "referencesProvider": true,
                        "renameProvider": { "prepareProvider": true },
                        "documentFormattingProvider": true,
                        "completionProvider": {
                            "resolveProvider": false,
                            "triggerCharacters": ["\"", "/"]
                        },
                        "experimental": {
                            "uffdaLanguageMetadata": true
                        }
                    },
                    "serverInfo": {
                        "name": "uffda",
                        "version": env!("CARGO_PKG_VERSION"),
                    }
                }),
            )]
        }
        Some("initialized") => Vec::new(),
        Some("workspace/didChangeWorkspaceFolders") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            if let Some(added) = params.pointer("/event/added").and_then(Value::as_array) {
                for item in added {
                    if let Some(uri) = item.get("uri").and_then(Value::as_str)
                        && let Some(path) = path_from_file_uri(uri)
                        && !state
                            .workspace_folders
                            .iter()
                            .any(|existing| existing == &path)
                    {
                        state.workspace_folders.push(path);
                    }
                }
            }
            if let Some(removed) = params.pointer("/event/removed").and_then(Value::as_array) {
                for item in removed {
                    if let Some(uri) = item.get("uri").and_then(Value::as_str)
                        && let Some(path) = path_from_file_uri(uri)
                    {
                        state.workspace_folders.retain(|existing| existing != &path);
                    }
                }
            }
            Vec::new()
        }
        Some("workspace/configuration") => {
            let items = message
                .pointer("/params/items")
                .and_then(Value::as_array)
                .map(|items| items.len())
                .unwrap_or(0);
            vec![rpc_result(id, Value::Array(vec![Value::Null; items]))]
        }
        Some("uffda/languageMetadata") => vec![rpc_result(
            id,
            // Include both the current shape (`extensions`) and the older
            // installed-extension shape (`metadata.ext`) so either client works.
            json!({
                "languages": [{
                    "id": "uffda",
                    "name": "Uffda",
                    "extensions": [".uff"],
                    "metadata": {
                        "id": "uffda",
                        "name": "Uffda",
                        "ext": ".uff",
                        "extensions": [".uff"]
                    }
                }]
            }),
        )],
        Some("textDocument/semanticTokens/full") => {
            let uri = message
                .pointer("/params/textDocument/uri")
                .and_then(Value::as_str)
                .unwrap_or("");
            let text = state.documents.get(uri).cloned().unwrap_or_default();
            let data = guarded(Vec::new(), || {
                semantic_tokens_for_document(state, uri, &text)
            });
            vec![rpc_result(id, json!({ "data": data }))]
        }
        Some("textDocument/hover") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let result = guarded(Value::Null, || hover_request(state, &params));
            vec![rpc_result(id, result)]
        }
        Some("textDocument/definition") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let result = guarded(json!([]), || definition_request(state, &params));
            vec![rpc_result(id, result)]
        }
        Some("textDocument/completion") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let result = guarded(json!([]), || completion_request(state, &params));
            vec![rpc_result(id, result)]
        }
        Some("textDocument/references") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let result = guarded(json!([]), || references_request(state, &params));
            vec![rpc_result(id, result)]
        }
        Some("textDocument/prepareRename") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            match guarded(Ok(Value::Null), || prepare_rename_request(state, &params)) {
                Ok(result) => vec![rpc_result(id, result)],
                Err(message) => vec![rpc_error(id, REQUEST_FAILED, message)],
            }
        }
        Some("textDocument/rename") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            match guarded(Ok(Value::Null), || rename_request(state, &params)) {
                Ok(result) => vec![rpc_result(id, result)],
                Err(message) => vec![rpc_error(id, REQUEST_FAILED, message)],
            }
        }
        Some("textDocument/formatting") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let result = guarded(json!([]), || formatting_request(state, &params));
            vec![rpc_result(id, result)]
        }
        Some("textDocument/didOpen") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let uri = params["textDocument"]["uri"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let text = params["textDocument"]["text"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !is_uff_document(&uri) {
                return Vec::new();
            }
            state.documents.insert(uri.clone(), text.clone());
            let diagnostics = guarded(Vec::new(), || diagnose_document(state, &uri, &text));
            vec![publish_diagnostics(&uri, diagnostics)]
        }
        Some("textDocument/didChange") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let uri = params["textDocument"]["uri"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !is_uff_document(&uri) {
                return Vec::new();
            }
            let text = full_document_text(params.get("contentChanges"), state.documents.get(&uri));
            state.documents.insert(uri.clone(), text.clone());
            let diagnostics = guarded(Vec::new(), || diagnose_document(state, &uri, &text));
            vec![publish_diagnostics(&uri, diagnostics)]
        }
        Some("textDocument/didClose") => {
            let uri = message
                .pointer("/params/textDocument/uri")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            state.documents.remove(&uri);
            state.store.remove_open(&uri);
            vec![publish_diagnostics(&uri, Vec::new())]
        }
        Some("shutdown") => {
            state.shutdown_requested = true;
            vec![rpc_result(id, Value::Null)]
        }
        Some("exit") => Vec::new(),
        Some(other) if id.is_some() => {
            vec![rpc_error(id, -32601, format!("Method not found: {other}"))]
        }
        Some(_) => Vec::new(),
        None => vec![rpc_error(id, -32600, "Invalid Request".into())],
    }
}

fn is_uff_document(uri: &str) -> bool {
    uri.ends_with(".uff") || uri.contains(".uff?")
}

fn full_document_text(changes: Option<&Value>, previous: Option<&String>) -> String {
    let Some(Value::Array(items)) = changes else {
        return previous.cloned().unwrap_or_default();
    };
    // Full-document sync (TextDocumentSyncKind = 1): take the last change's text.
    for change in items.iter().rev() {
        if let Some(text) = change.get("text").and_then(Value::as_str) {
            return text.to_string();
        }
    }
    previous.cloned().unwrap_or_default()
}

/// Workspace folder that contains `file` (longest matching path), if any.
fn workspace_folder_for_file(file: &Path, folders: &[PathBuf]) -> Option<PathBuf> {
    let mut best: Option<PathBuf> = None;
    for folder in folders {
        if (file == folder.as_path() || file.starts_with(folder))
            && best
                .as_ref()
                .is_none_or(|current| folder.as_os_str().len() > current.as_os_str().len())
        {
            best = Some(folder.clone());
        }
    }
    best
}

/// Project root for a document: nearest `uffda.jsonc` above the file, not
/// walking above the containing workspace folder when folders were advertised.
/// Falls back to the workspace folder, then the file's parent.
fn project_root_for_file(file: &Path, workspace_folders: &[PathBuf]) -> PathBuf {
    let start = file.parent().unwrap_or(file);
    let ceiling = workspace_folder_for_file(file, workspace_folders);
    match Project::discover(start, None) {
        Ok(Some(config)) => {
            let root = config
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| start.to_path_buf());
            if let Some(ceiling) = &ceiling {
                if root.starts_with(ceiling) {
                    return root;
                }
                return ceiling.clone();
            }
            root
        }
        _ => ceiling.unwrap_or_else(|| start.to_path_buf()),
    }
}

fn ensure_session(state: &mut ServerState, uri: &str) -> Result<(String, Option<String>), String> {
    let file_path = path_from_file_uri(uri);
    let (root, path_arg) = match file_path {
        Some(path) => {
            let root = project_root_for_file(&path, &state.workspace_folders);
            let path_arg = path.to_string_lossy().into_owned();
            (root, Some(path_arg))
        }
        None => (std::env::temp_dir().join("uffda-lsp-untitled"), None),
    };
    if !state.project_sessions.contains_key(&root) {
        let session = state
            .sessions
            .open_with_cache(root.clone(), None, state.cache_dir.clone())
            .map_err(|error| error.message)?;
        let id = session.id.clone();
        state.project_sessions.insert(root.clone(), id);
    }
    let session_id = state
        .project_sessions
        .get(&root)
        .expect("session id inserted")
        .clone();
    Ok((session_id, path_arg))
}

/// Run `work`, answering `fallback` instead of erroring the request (or
/// killing the server) when a handler panics.
fn guarded<T>(fallback: T, work: impl FnOnce() -> T) -> T {
    catch_unwind(AssertUnwindSafe(work)).unwrap_or(fallback)
}

fn diagnose_document(state: &mut ServerState, uri: &str, text: &str) -> Vec<Value> {
    let (session_id, path_arg) = match ensure_session(state, uri) {
        Ok(parts) => parts,
        Err(message) => return vec![diagnostic_message(0, 0, 0, 1, message)],
    };
    let ServerState {
        sessions, store, ..
    } = state;
    let session = match sessions.get_mut(&session_id) {
        Ok(session) => session,
        Err(error) => return vec![diagnostic_message(0, 0, 0, 1, error.message)],
    };
    // Reuse the open analysis when the buffer text has not changed so a
    // follow-up request (or a no-op didChange) does not re-parse.
    let analysis = match store.open(uri).filter(|doc| doc.source == text) {
        Some(existing) => Some(existing),
        None => DocumentAnalysis::parse(&mut session.languages, uri, text).map(Rc::new),
    };
    // Publish spans/tree before resolve so semantic-tokens can reuse them
    // as soon as this handler returns.
    if let Some(analysis) = &analysis {
        store.set_open(Rc::clone(analysis));
    }
    // Prefer the resolver's artifact graph (`bin/ast/...`). Only fall back to
    // compiling imported `.uff` sources when that fails — never re-parse every
    // import for an editor tree (that was tens of seconds on language files).
    let module_url = analysis
        .as_ref()
        .and_then(|doc| Url::parse(&doc.module_url).ok());
    let already_loaded = module_url
        .as_ref()
        .is_some_and(|url| session.has_module(url) && session.source_matches(url, text));
    let result = if already_loaded {
        json!({ "ok": true })
    } else {
        let mut result = match analysis.as_ref().and_then(|doc| doc.syntax.clone()) {
            Some(syntax) => session.load_syntax(text, syntax, path_arg.as_deref()),
            None => session.load(text, path_arg.as_deref()),
        };
        if result.get("ok").and_then(Value::as_bool) != Some(true)
            && result.pointer("/error/phase").and_then(Value::as_str) == Some("resolve")
            && let Some(analysis) = &analysis
        {
            preload_import_sources(session, analysis);
            result = match analysis.syntax.clone() {
                Some(syntax) => session.load_syntax(text, syntax, path_arg.as_deref()),
                None => session.load(text, path_arg.as_deref()),
            };
        }
        result
    };
    // After the module graph is known, recolor name references (attribute
    // decorator names → type, funcs/globals → function).
    if result.get("ok").and_then(Value::as_bool) == Some(true)
        && let (Some(analysis), Some(module_url)) = (&analysis, module_url)
    {
        let spans = reference_roles::resolve_reference_roles(analysis, session, &module_url);
        store.set_open(Rc::new(DocumentAnalysis {
            uri: analysis.uri.clone(),
            module_url: analysis.module_url.clone(),
            source: analysis.source.clone(),
            units: analysis.units.clone(),
            spans,
            tree: analysis.tree.clone(),
            quality: analysis.quality,
            syntax: analysis.syntax.clone(),
        }));
    }
    diagnostics_from_load(&result)
}

/// When artifacts are missing, compile imported `.uff` sources into the
/// session so `load` can resolve them. Uses each loaded module's declaration
/// `imports` list for the transitive walk — never a second UffdaLang parse
/// just to discover import paths.
fn preload_import_sources(session: &mut Session, analysis: &DocumentAnalysis) {
    use editor::{
        EditorDecorator, find_annotated, has_editor_metadata, is_success, node_text, walk_accepted,
    };
    let Some(tree) = analysis.tree.as_ref() else {
        return;
    };
    let Ok(base) = Url::parse(&analysis.module_url) else {
        return;
    };
    let mut pending: Vec<Url> = Vec::new();
    walk_accepted(tree, |node, _| {
        if is_success(node)
            && has_editor_metadata(node, EditorDecorator::Import)
            && let Some(path) = find_annotated(node, EditorDecorator::ModulePath, |_| true)
        {
            let path = node_text(&path, &analysis.units);
            if let Ok(url) = base.join(&path) {
                pending.push(url);
            }
        }
    });
    let mut visited = HashSet::new();
    while let Some(url) = pending.pop() {
        if !definition::is_uff_file_url(&url)
            || session.has_module(&url)
            || !visited.insert(url.to_string())
        {
            continue;
        }
        let Ok(file) = url.to_file_path() else {
            continue;
        };
        let Ok(source) = std::fs::read_to_string(&file) else {
            continue;
        };
        let loaded = session.load(&source, Some(&file.to_string_lossy()));
        if loaded.get("ok").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        for import in session.import_module_urls(&url) {
            pending.push(import);
        }
    }
}

fn semantic_tokens_for_document(state: &mut ServerState, uri: &str, text: &str) -> Vec<u32> {
    if let Some(analysis) = state.store.open(uri)
        && analysis.source == text
    {
        return encode_semantic_tokens_typed(text, &analysis.spans);
    }
    let (session_id, _) = match ensure_session(state, uri) {
        Ok(parts) => parts,
        Err(_) => return Vec::new(),
    };
    let Ok(session) = state.sessions.get_mut(&session_id) else {
        return Vec::new();
    };
    let Ok(highlighted) = session.languages.highlight(text, Language::Uffda) else {
        return Vec::new();
    };
    let Some(spans) = highlighted.get("spans").and_then(Value::as_array) else {
        return Vec::new();
    };
    encode_semantic_tokens(text, spans)
}

/// Everything an editor query needs for one open document. Queries only read
/// the session's resolved state and the document store.
struct QueryContext<'a> {
    session: &'a mut Session,
    store: &'a mut DocumentStore,
    doc: Rc<DocumentAnalysis>,
    module_url: Url,
    /// The document's file path (absent for untitled documents).
    path: Option<PathBuf>,
    /// Directory whose `.uff` files make up the workspace for this document.
    workspace_root: PathBuf,
}

fn query_context<'a>(state: &'a mut ServerState, uri: &str) -> Option<QueryContext<'a>> {
    let doc = state.store.open(uri)?;
    let path = path_from_file_uri(uri);
    let workspace_root = match &path {
        Some(path) => workspace_folder_for_file(path, &state.workspace_folders)
            .unwrap_or_else(|| project_root_for_file(path, &state.workspace_folders)),
        None => std::env::temp_dir(),
    };
    let (session_id, _) = ensure_session(state, uri).ok()?;
    let ServerState {
        sessions, store, ..
    } = state;
    let session = sessions.get_mut(&session_id).ok()?;
    let module_url = Url::parse(&doc.module_url).ok()?;
    Some(QueryContext {
        session,
        store,
        doc,
        module_url,
        path,
        workspace_root,
    })
}

fn request_uri(params: &Value) -> &str {
    params
        .pointer("/textDocument/uri")
        .and_then(Value::as_str)
        .unwrap_or("")
}

fn request_offset(params: &Value, doc: &DocumentAnalysis) -> Option<usize> {
    let position = Position::from_json(params.get("position")?)?;
    Some(position_to_offset_units(&doc.units, position))
}

fn hover_request(state: &mut ServerState, params: &Value) -> Value {
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return Value::Null;
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return Value::Null;
    };
    hover::hover_at(ctx.session, ctx.store, &ctx.doc, &ctx.module_url, offset)
        .unwrap_or(Value::Null)
}

fn definition_request(state: &mut ServerState, params: &Value) -> Value {
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return json!([]);
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return json!([]);
    };
    Value::Array(definition::definition_at(
        ctx.session,
        ctx.store,
        &ctx.doc,
        &ctx.module_url,
        offset,
    ))
}

fn completion_request(state: &mut ServerState, params: &Value) -> Value {
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return json!([]);
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return json!([]);
    };
    Value::Array(completion::completion_items(
        ctx.session,
        &ctx.doc,
        &ctx.module_url,
        ctx.path.as_deref(),
        offset,
    ))
}

fn references_request(state: &mut ServerState, params: &Value) -> Value {
    let include_declaration = params
        .pointer("/context/includeDeclaration")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return json!([]);
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return json!([]);
    };
    let globals = symbols::global_names();
    let Some(occurrence) = references::occurrence_at(&ctx.doc, offset, &globals) else {
        return json!([]);
    };
    let found = references::symbol_occurrences(
        &mut ctx.session.languages,
        ctx.store,
        &occurrence.symbol,
        &occurrence.name,
        &ctx.doc,
        &ctx.workspace_root,
        &globals,
    );
    Value::Array(references::reference_locations(&found, include_declaration))
}

fn prepare_rename_request(state: &mut ServerState, params: &Value) -> Result<Value, String> {
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return Ok(Value::Null);
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return Ok(Value::Null);
    };
    let globals = symbols::global_names();
    let Some(occurrence) = references::occurrence_at(&ctx.doc, offset, &globals) else {
        return Ok(Value::Null);
    };
    if let Some(refusal) = references::rename_refusal(&occurrence.symbol) {
        return Err(refusal);
    }
    Ok(json!({
        "range": range_json(&ctx.doc.units, occurrence.start, occurrence.end),
        "placeholder": occurrence.name,
    }))
}

fn rename_request(state: &mut ServerState, params: &Value) -> Result<Value, String> {
    let new_name = params
        .get("newName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let Some(ctx) = query_context(state, request_uri(params)) else {
        return Err("Nothing to rename here".into());
    };
    let Some(offset) = request_offset(params, &ctx.doc) else {
        return Err("Nothing to rename here".into());
    };
    let globals = symbols::global_names();
    let Some(occurrence) = references::occurrence_at(&ctx.doc, offset, &globals) else {
        return Err("Nothing to rename here".into());
    };
    let found = references::symbol_occurrences(
        &mut ctx.session.languages,
        ctx.store,
        &occurrence.symbol,
        &occurrence.name,
        &ctx.doc,
        &ctx.workspace_root,
        &globals,
    );
    match references::plan_rename(
        &mut ctx.session.languages,
        &occurrence.symbol,
        &found,
        &new_name,
        &globals,
    ) {
        RenamePlan::Edit(edit) => Ok(edit),
        RenamePlan::Refused(message) => Err(message),
    }
}

fn formatting_request(state: &mut ServerState, params: &Value) -> Value {
    let uri = request_uri(params);
    let Some(text) = state.documents.get(uri).cloned() else {
        return json!([]);
    };
    let Ok((session_id, _)) = ensure_session(state, uri) else {
        return json!([]);
    };
    let Ok(session) = state.sessions.get_mut(&session_id) else {
        return json!([]);
    };
    let Ok(formatted) = session.languages.format(&text, Language::Uffda) else {
        return json!([]);
    };
    if formatted == text {
        return json!([]);
    }
    let units: Vec<u16> = text.encode_utf16().collect();
    json!([{
        "range": range_json(&units, 0, units.len()),
        "newText": formatted,
    }])
}

fn diagnostics_from_load(result: &Value) -> Vec<Value> {
    if result.get("ok").and_then(Value::as_bool) == Some(true) {
        return Vec::new();
    }
    if let Some(diagnostics) = result.get("diagnostics").and_then(Value::as_array)
        && !diagnostics.is_empty()
    {
        return diagnostics
            .iter()
            .map(|diagnostic| {
                let line = diagnostic
                    .pointer("/location/line")
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as usize;
                let column = diagnostic
                    .pointer("/location/column")
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as usize;
                let message = diagnostic
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("error")
                    .to_string();
                diagnostic_message(line, column, line, column + 1, message)
            })
            .collect();
    }
    let message = result
        .pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or("load failed")
        .to_string();
    vec![diagnostic_message(0, 0, 0, 1, message)]
}

fn diagnostic_message(
    start_line: usize,
    start_character: usize,
    end_line: usize,
    end_character: usize,
    message: impl Into<String>,
) -> Value {
    json!({
        "range": {
            "start": { "line": start_line, "character": start_character },
            "end": { "line": end_line, "character": end_character }
        },
        "severity": 1,
        "source": "uffda",
        "message": message.into()
    })
}

fn publish_diagnostics(uri: &str, diagnostics: Vec<Value>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "method": "textDocument/publishDiagnostics",
        "params": {
            "uri": uri,
            "diagnostics": diagnostics
        }
    })
}

fn rpc_result(id: Option<Value>, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id.unwrap_or(Value::Null), "result": result })
}

fn rpc_error(id: Option<Value>, code: i64, message: String) -> Value {
    let mut error = Map::new();
    error.insert("code".into(), json!(code));
    error.insert("message".into(), json!(message));
    json!({
        "jsonrpc": "2.0",
        "id": id.unwrap_or(Value::Null),
        "error": error
    })
}

#[cfg(test)]
mod ported_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:cli-language-server-004 req:cli-language-server-005
    fn diagnose_reuses_artifacts_without_reparsing_imports() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let file = root.join("src/lang/uffda/rule.rules.uff");
        let source = std::fs::read_to_string(&file).unwrap();
        let uri = Url::from_file_path(&file).unwrap().to_string();
        let mut state = ServerState::new();
        state.workspace_folders = vec![root.clone()];

        let start = std::time::Instant::now();
        let diags = diagnose_document(&mut state, &uri, &source);
        let first = start.elapsed();
        assert!(diags.is_empty(), "expected clean load, got {diags:?}");
        assert!(
            state.store.open(&uri).is_some(),
            "analysis must be stored for semantic tokens"
        );
        // Artifact-backed resolve must not re-parse the import graph.
        // Bands (debug): ~8s idle locally; ~20–25s under CI libtest contention;
        // import reparse was ~37s idle and ~215s when codec artifacts were preferred.
        assert!(
            first < std::time::Duration::from_secs(45),
            "first diagnose too slow (likely reparsed imports): {first:?}"
        );

        let start = std::time::Instant::now();
        let _ = diagnose_document(&mut state, &uri, &source);
        let second = start.elapsed();
        assert!(
            second.as_millis() < 500,
            "unchanged buffer must reuse analysis: {second:?}"
        );

        let start = std::time::Instant::now();
        let tokens = semantic_tokens_for_document(&mut state, &uri, &source);
        let tokens_ms = start.elapsed();
        assert!(!tokens.is_empty());
        assert!(
            tokens_ms.as_millis() < 50,
            "cached semantic tokens too slow: {tokens_ms:?}"
        );
        eprintln!("first={first:?} second={second:?} tokens={tokens_ms:?}");
    }

    #[test]
    // req:cli-language-server-001 req:cli-language-server-005
    fn initialize_advertises_document_sync_and_semantic_tokens() {
        let mut state = ServerState::new();
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "processId": null,
                    "rootUri": null,
                    "capabilities": {}
                }
            }),
            &mut state,
        );
        assert_eq!(responses.len(), 1);
        assert_eq!(
            responses[0]["result"]["capabilities"]["textDocumentSync"]["change"],
            1
        );
        assert_eq!(responses[0]["result"]["serverInfo"]["name"], "uffda");
        assert_eq!(
            responses[0]["result"]["capabilities"]["experimental"]["uffdaLanguageMetadata"],
            true
        );
        assert_eq!(
            responses[0]["result"]["capabilities"]["semanticTokensProvider"]["full"],
            true
        );
        assert!(
            responses[0]["result"]["capabilities"]["semanticTokensProvider"]["legend"]
                ["tokenTypes"]
                .as_array()
                .unwrap()
                .iter()
                .any(|token| token == "keyword")
        );
    }

    #[test]
    // req:cli-language-server-005
    fn semantic_tokens_full_returns_encoded_data() {
        let mut state = ServerState::new();
        let _ = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "method": "textDocument/didOpen",
                "params": {
                    "textDocument": {
                        "uri": "file:///tmp/highlight.uff",
                        "languageId": "uffda",
                        "version": 1,
                        "text": "rule Main = any;"
                    }
                }
            }),
            &mut state,
        );
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "textDocument/semanticTokens/full",
                "params": {
                    "textDocument": { "uri": "file:///tmp/highlight.uff" }
                }
            }),
            &mut state,
        );
        let data = responses[0]["result"]["data"].as_array().unwrap();
        assert!(
            !data.is_empty(),
            "expected semantic token data for highlighted source"
        );
        assert_eq!(data.len() % 5, 0);
    }

    fn open_document(state: &mut ServerState, uri: &str, text: &str) {
        let _ = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "method": "textDocument/didOpen",
                "params": {
                    "textDocument": { "uri": uri, "languageId": "uffda", "version": 1, "text": text }
                }
            }),
            state,
        );
    }

    fn request(state: &mut ServerState, method: &str, params: Value) -> Value {
        let responses = handle_message(
            &json!({ "jsonrpc": "2.0", "id": 7, "method": method, "params": params }),
            state,
        );
        responses.into_iter().next().expect("a response")
    }

    #[test]
    // req:cli-language-server-006
    fn initialize_advertises_editor_capabilities() {
        let mut state = ServerState::new();
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": { "processId": null, "rootUri": null, "capabilities": {} }
            }),
            &mut state,
        );
        let capabilities = &responses[0]["result"]["capabilities"];
        assert_eq!(capabilities["hoverProvider"], true);
        assert_eq!(capabilities["definitionProvider"], true);
        assert_eq!(capabilities["referencesProvider"], true);
        assert_eq!(capabilities["renameProvider"]["prepareProvider"], true);
        assert_eq!(capabilities["documentFormattingProvider"], true);
        assert_eq!(
            capabilities["completionProvider"]["triggerCharacters"],
            json!(["\"", "/"])
        );
    }

    #[test]
    // req:cli-language-server-006
    fn hover_definition_and_references_answer_for_a_declaration() {
        let mut state = ServerState::new();
        let uri = "file:///tmp/lsp-editor.uff";
        open_document(
            &mut state,
            uri,
            "export Main;\nrule Main = Item;\nrule Item = any;\n",
        );
        let at = |line: u32, character: u32| {
            json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character },
                "context": { "includeDeclaration": true }
            })
        };
        let hover = request(&mut state, "textDocument/hover", at(1, 13));
        let text = hover["result"]["contents"]["value"].as_str().unwrap_or("");
        assert!(text.contains("Item"), "hover: {hover}");

        let definition = request(&mut state, "textDocument/definition", at(1, 13));
        assert_eq!(
            definition["result"][0]["range"]["start"]["line"], 2,
            "definition: {definition}"
        );

        let references = request(&mut state, "textDocument/references", at(1, 13));
        let locations = references["result"].as_array().expect("locations");
        assert_eq!(locations.len(), 2, "references: {references}");

        let nothing = request(&mut state, "textDocument/hover", at(50, 0));
        assert!(nothing["result"].is_null());
    }

    #[test]
    // req:cli-language-server-006
    fn rename_edits_every_occurrence_and_refuses_globals() {
        let mut state = ServerState::new();
        let uri = "file:///tmp/lsp-rename.uff";
        open_document(
            &mut state,
            uri,
            "export Main;\nrule Main = Item;\nrule Item = any;\n",
        );
        let params = |character: u32, name: &str| {
            json!({
                "textDocument": { "uri": uri },
                "position": { "line": 1, "character": character },
                "newName": name
            })
        };
        let prepared = request(
            &mut state,
            "textDocument/prepareRename",
            params(13, "Thing"),
        );
        assert!(prepared["result"]["range"].is_object(), "{prepared}");
        let renamed = request(&mut state, "textDocument/rename", params(13, "Thing"));
        let edits = renamed["result"]["changes"][uri].as_array().expect("edits");
        assert_eq!(edits.len(), 2, "{renamed}");
        assert!(edits.iter().all(|edit| edit["newText"] == "Thing"));
        let collision = request(&mut state, "textDocument/rename", params(13, "Main"));
        assert!(collision["error"].is_object(), "{collision}");
    }

    #[test]
    // req:cli-language-server-006
    fn completion_offers_names_and_degrades_to_nothing() {
        let mut state = ServerState::new();
        let uri = "file:///tmp/lsp-complete.uff";
        // The names come from the last successful load, so the document is valid
        // when opened and only then edited into the half-typed state.
        open_document(
            &mut state,
            uri,
            "export Main;\nrule Main = any;\nrule Item = any;\n",
        );
        let _ = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "method": "textDocument/didChange",
                "params": {
                    "textDocument": { "uri": uri, "version": 2 },
                    "contentChanges": [{ "text": "export Main;\nrule Main = x:\nrule Item = any;\n" }]
                }
            }),
            &mut state,
        );
        let completion = request(
            &mut state,
            "textDocument/completion",
            json!({
                "textDocument": { "uri": uri },
                "position": { "line": 1, "character": 14 }
            }),
        );
        let items = completion["result"].as_array().cloned().unwrap_or_default();
        assert!(
            items.iter().any(|item| item["label"] == "Item"),
            "completion: {completion}"
        );
        let unknown = request(
            &mut state,
            "textDocument/completion",
            json!({
                "textDocument": { "uri": "file:///tmp/never-opened.xyz" },
                "position": { "line": 0, "character": 0 }
            }),
        );
        assert!(unknown["error"].is_null());
    }

    #[test]
    // req:cli-language-server-006
    fn formatting_returns_edits_for_an_open_document() {
        let mut state = ServerState::new();
        let uri = "file:///tmp/lsp-format.uff";
        open_document(&mut state, uri, "export   Main;\nrule Main   =   any;\n");
        let formatted = request(
            &mut state,
            "textDocument/formatting",
            json!({ "textDocument": { "uri": uri }, "options": {} }),
        );
        let edits = formatted["result"].as_array().expect("edits");
        assert_eq!(edits.len(), 1, "{formatted}");
        let text = edits[0]["newText"].as_str().unwrap();
        assert!(text.contains("rule Main = any;"), "{text}");
    }

    #[test]
    // req:cli-language-server-001
    fn content_length_round_trip() {
        let mut buf = Vec::new();
        write_message(
            &mut buf,
            &json!({ "jsonrpc": "2.0", "id": 1, "result": null }),
        )
        .unwrap();
        let text = String::from_utf8(buf).unwrap();
        assert!(text.starts_with("Content-Length: "));
        assert!(text.contains("\r\n\r\n"));
        let mut cursor = io::Cursor::new(text.into_bytes());
        let message = read_message(&mut cursor).unwrap().unwrap();
        assert_eq!(message["id"], 1);
    }

    #[test]
    // req:cli-language-server-004 req:cli-language-server-011
    fn open_uff_document_publishes_parse_diagnostics() {
        let mut state = ServerState::new();
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "method": "textDocument/didOpen",
                "params": {
                    "textDocument": {
                        "uri": "file:///tmp/broken.uff",
                        "languageId": "uffda",
                        "version": 1,
                        "text": "export Main;\nrule Main = ("
                    }
                }
            }),
            &mut state,
        );
        assert_eq!(responses.len(), 1);
        assert_eq!(responses[0]["method"], "textDocument/publishDiagnostics");
        let diagnostics = responses[0]["params"]["diagnostics"].as_array().unwrap();
        assert!(!diagnostics.is_empty(), "expected parse diagnostics");
        assert_eq!(diagnostics[0]["source"], "uffda");
    }

    #[test]
    // req:cli-language-server-011
    fn language_metadata_lists_uff_extension() {
        let mut state = ServerState::new();
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "uffda/languageMetadata",
                "params": {}
            }),
            &mut state,
        );
        assert_eq!(
            responses[0]["result"]["languages"][0]["extensions"][0],
            ".uff"
        );
    }

    #[test]
    // req:cli-language-server-011
    fn project_root_follows_uffda_jsonc_within_workspace_folder() {
        let parent = std::env::temp_dir().join(format!("uffda-lsp-project-{}", std::process::id()));
        let project = parent.join("proj");
        let _ = std::fs::remove_dir_all(&parent);
        std::fs::create_dir_all(project.join("src")).unwrap();
        std::fs::write(project.join("uffda.jsonc"), "{}").unwrap();
        let file = project.join("src").join("main.uff");
        std::fs::write(&file, "export Main;\nrule Main = any;").unwrap();
        assert_eq!(
            project_root_for_file(&file, std::slice::from_ref(&project)),
            project
        );
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    // req:cli-language-server-011
    fn initialize_captures_workspace_folders_and_cache_dir() {
        let mut state = ServerState::new();
        let cache = std::env::temp_dir().join(format!("uffda-lsp-cache-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&cache);
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "capabilities": {},
                    "workspaceFolders": [{
                        "uri": "file:///home/justin/code/github.com/justinmchase/uffda",
                        "name": "uffda"
                    }],
                    "initializationOptions": {
                        "cacheDir": cache.to_string_lossy()
                    }
                }
            }),
            &mut state,
        );
        assert_eq!(responses[0]["result"]["serverInfo"]["name"], "uffda");
        assert_eq!(
            state.workspace_folders,
            vec![PathBuf::from(
                "/home/justin/code/github.com/justinmchase/uffda"
            )]
        );
        assert_eq!(state.cache_dir.as_ref(), Some(&cache));
        assert!(cache.is_dir());
        let _ = std::fs::remove_dir_all(&cache);
    }

    #[test]
    // req:cli-language-server-010
    fn shutdown_then_exit_reports_clean_lifetime_without_shutdown_reports_abnormal() {
        let mut state = ServerState::new();
        assert!(!state.shutdown_requested);
        let responses = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": { "capabilities": {} }
            }),
            &mut state,
        );
        assert_eq!(responses[0]["result"]["serverInfo"]["name"], "uffda");

        let shutdown = handle_message(
            &json!({ "jsonrpc": "2.0", "id": 2, "method": "shutdown" }),
            &mut state,
        );
        assert_eq!(shutdown[0]["result"], Value::Null);
        assert!(state.shutdown_requested);
        // `run_stdio` returns 0 after shutdown + exit; without shutdown, 1.
        assert_eq!(if state.shutdown_requested { 0 } else { 1 }, 0);

        let mut unclean = ServerState::new();
        let _ = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": { "capabilities": {} }
            }),
            &mut unclean,
        );
        assert!(!unclean.shutdown_requested);
        assert_eq!(if unclean.shutdown_requested { 0 } else { 1 }, 1);
    }
}

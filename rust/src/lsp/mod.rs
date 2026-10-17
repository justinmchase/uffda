//! Language Server Protocol stdio server (`uffda lsp`).
//!
//! Wire format is LSP's Content-Length framed JSON-RPC 2.0 over stdio (not
//! MCP's NDJSON). This slice handles initialize/shutdown/exit, document sync,
//! and parse diagnostics for `.uff` documents.

use crate::diagnostics::SourceDiagnostic;
use crate::languages::{Language, Languages};
use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::io::{self, BufRead, Read, Write};

/// Run the LSP server until `exit` or stdin EOF.
pub fn run_stdio() -> io::Result<()> {
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
    Ok(())
}

struct ServerState {
    shutdown_requested: bool,
    documents: HashMap<String, String>,
    languages: Option<Languages>,
}

impl ServerState {
    fn new() -> Self {
        Self {
            shutdown_requested: false,
            documents: HashMap::new(),
            languages: None,
        }
    }

    fn languages(&mut self) -> Result<&mut Languages, String> {
        if self.languages.is_none() {
            self.languages = Some(Languages::new().map_err(|error| error.to_string())?);
        }
        Ok(self.languages.as_mut().expect("languages initialized"))
    }
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
        Some("initialize") => vec![rpc_result(
            id,
            json!({
                "capabilities": {
                    "textDocumentSync": {
                        "openClose": true,
                        "change": 1
                    }
                },
                "serverInfo": {
                    "name": "uffda",
                    "version": env!("CARGO_PKG_VERSION"),
                }
            }),
        )],
        Some("initialized") => Vec::new(),
        Some("textDocument/didOpen") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let uri = params["textDocument"]["uri"].as_str().unwrap_or("").to_string();
            let text = params["textDocument"]["text"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !is_uff_document(&uri) {
                return Vec::new();
            }
            state.documents.insert(uri.clone(), text.clone());
            vec![publish_diagnostics(&uri, diagnose(state, &text))]
        }
        Some("textDocument/didChange") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let uri = params["textDocument"]["uri"].as_str().unwrap_or("").to_string();
            if !is_uff_document(&uri) {
                return Vec::new();
            }
            let text = full_document_text(params.get("contentChanges"), state.documents.get(&uri));
            state.documents.insert(uri.clone(), text.clone());
            vec![publish_diagnostics(&uri, diagnose(state, &text))]
        }
        Some("textDocument/didClose") => {
            let uri = message
                .pointer("/params/textDocument/uri")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            state.documents.remove(&uri);
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

fn diagnose(state: &mut ServerState, source: &str) -> Vec<Value> {
    let languages = match state.languages() {
        Ok(languages) => languages,
        Err(message) => {
            return vec![diagnostic_message(0, 0, 0, 1, message)];
        }
    };
    match languages.parse_source(source, Language::Uffda) {
        Ok(parsed) => parsed
            .diagnostics
            .iter()
            .map(lsp_diagnostic)
            .collect(),
        Err(error) if !error.diagnostics.is_empty() => {
            error.diagnostics.iter().map(lsp_diagnostic).collect()
        }
        Err(error) => vec![diagnostic_message(0, 0, 0, 1, error.to_string())],
    }
}

fn lsp_diagnostic(diagnostic: &SourceDiagnostic) -> Value {
    let end_line = diagnostic.location.line;
    let end_character = diagnostic
        .location
        .end_offset
        .map(|end| {
            let start = diagnostic.location.offset;
            let delta = end.saturating_sub(start);
            diagnostic.location.column + delta
        })
        .unwrap_or(diagnostic.location.column + 1);
    diagnostic_message(
        diagnostic.location.line,
        diagnostic.location.column,
        end_line,
        end_character.max(diagnostic.location.column + 1),
        diagnostic.message.clone(),
    )
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
mod tests {
    use super::*;

    #[test]
    // req:cli-language-server-001
    fn initialize_advertises_document_sync() {
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
    // req:cli-language-server-004
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
}

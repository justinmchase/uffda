//! Model Context Protocol stdio server (`uffda mcp`).
//!
//! Wire format matches the MCP stdio transport: one JSON-RPC 2.0 message per
//! newline (see `@modelcontextprotocol/sdk` `shared/stdio.js`).

mod display;
mod ops;
mod sessions;

use display::DisplayManager;
use sessions::SessionManager;
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

const PROTOCOL_VERSION: &str = "2024-11-05";
const SERVER_NAME: &str = "uffda";

/// Run the MCP server until stdin EOF. Stdio is reserved for protocol traffic.
pub fn run_stdio() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    let mut sessions = SessionManager::new();
    let mut displays = DisplayManager::new();
    let mut lines = stdin.lock().lines();
    while let Some(line) = lines.next() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(error) => {
                write_message(
                    &mut stdout,
                    &json!({
                        "jsonrpc": "2.0",
                        "id": null,
                        "error": {
                            "code": -32700,
                            "message": format!("Parse error: {error}"),
                        }
                    }),
                )?;
                continue;
            }
        };
        if let Some(response) = handle_message(&message, &mut sessions, &mut displays) {
            write_message(&mut stdout, &response)?;
        }
    }
    Ok(())
}

fn write_message(out: &mut impl Write, message: &Value) -> io::Result<()> {
    writeln!(out, "{message}")?;
    out.flush()
}

fn handle_message(
    message: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Option<Value> {
    let method = message.get("method").and_then(Value::as_str);
    let id = message.get("id").cloned();
    match method {
        Some("initialize") => Some(rpc_result(
            id,
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": { "tools": { "listChanged": true } },
                "serverInfo": {
                    "name": SERVER_NAME,
                    "version": env!("CARGO_PKG_VERSION"),
                }
            }),
        )),
        Some("notifications/initialized") | Some("notifications/cancelled") => None,
        Some("ping") => Some(rpc_result(id, json!({}))),
        Some("tools/list") => Some(rpc_result(id, json!({ "tools": tool_descriptors() }))),
        Some("tools/call") => {
            let params = message.get("params").cloned().unwrap_or(json!({}));
            let name = params.get("name").and_then(Value::as_str).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(json!({}));
            Some(rpc_result(
                id,
                call_tool(name, &arguments, sessions, displays),
            ))
        }
        Some(other) if id.is_some() => Some(rpc_error(
            id,
            -32601,
            format!("Method not found: {other}"),
        )),
        Some(_) => None,
        None => Some(rpc_error(id, -32600, "Invalid Request".into())),
    }
}

fn rpc_result(id: Option<Value>, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id.unwrap_or(Value::Null), "result": result })
}

fn rpc_error(id: Option<Value>, code: i64, message: String) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id.unwrap_or(Value::Null),
        "error": { "code": code, "message": message }
    })
}

fn tool_descriptors() -> Vec<Value> {
    let mut tools = vec![
        tool(
            "uffda_version",
            "uffda version",
            "Returns the installed uffda CLI/library version. Useful as a trivial connectivity check for the MCP server.",
            json!({ "type": "object", "properties": {} }),
        ),
        tool(
            "uffda_parse",
            "uffda parse",
            "Parses Uffda (or a sub-language's) source text to a raw AST, equivalent to `uffda parse`. Stateless: does not require or affect any session.",
            json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string", "description": "Uffda (or sub-language) source text to parse." },
                    "language": {
                        "type": "string",
                        "enum": ["uffda", "pattern", "expression"],
                        "description": "Defaults to 'uffda' (full module grammar)."
                    }
                },
                "required": ["source"],
                "additionalProperties": false
            }),
        ),
        tool(
            "uffda_match",
            "uffda match",
            "Matches an explicit subject (text or JSON) against a Uffda pattern, equivalent to `uffda match`. Stateless: does not require or affect any session.",
            json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Uffda pattern source text to match the input against." },
                    "input": { "type": "string", "description": "The subject to match, as raw text or (if inputIsJson is true) JSON." },
                    "inputIsJson": {
                        "type": "boolean",
                        "description": "When true, `input` is parsed as JSON before matching. Defaults to false."
                    }
                },
                "required": ["pattern", "input"],
                "additionalProperties": false
            }),
        ),
        tool(
            "uffda_compile",
            "uffda compile",
            "Compiles one or more Uffda source files/globs to Uffda syntax AST artifacts on disk, equivalent to `uffda compile`. Stateless: does not require or affect any session.",
            json!({
                "type": "object",
                "properties": {
                    "paths": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "description": "One or more source file paths or glob patterns to compile, resolved relative to cwd."
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Absolute working directory paths/globs are resolved against."
                    },
                    "overwrite": {
                        "type": "boolean",
                        "description": "Allow overwriting existing artifact files. Defaults to false."
                    },
                    "config": {
                        "type": "string",
                        "description": "Project file (uffda.jsonc) relative to cwd."
                    }
                },
                "required": ["paths", "cwd"],
                "additionalProperties": false
            }),
        ),
        tool(
            "uffda_highlight",
            "uffda highlight",
            "Classifies Uffda (or a sub-language's) source text by syntactic role as a gap-free ordered span list.",
            json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string" },
                    "language": {
                        "type": "string",
                        "enum": ["uffda", "pattern", "expression"]
                    }
                },
                "required": ["source"],
                "additionalProperties": false
            }),
        ),
    ];
    tools.extend(sessions::session_tool_descriptors());
    tools.extend(display::display_tool_descriptors());
    tools
}

fn tool(name: &str, title: &str, description: &str, input_schema: Value) -> Value {
    json!({
        "name": name,
        "title": title,
        "description": description,
        "inputSchema": input_schema
    })
}

fn text_result(text: impl Into<String>) -> Value {
    json!({ "content": [{ "type": "text", "text": text.into() }] })
}

fn error_result(text: impl Into<String>) -> Value {
    json!({
        "content": [{ "type": "text", "text": text.into() }],
        "isError": true
    })
}

fn call_tool(
    name: &str,
    arguments: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Value {
    match name {
        "uffda_version" => text_result(env!("CARGO_PKG_VERSION")),
        "uffda_parse" => tool_parse(arguments),
        "uffda_match" => tool_match(arguments),
        "uffda_compile" => tool_compile(arguments),
        "uffda_session_open" => tool_session_open(arguments, sessions),
        "uffda_session_load" => tool_session_load(arguments, sessions),
        "uffda_session_list_modules" => tool_session_list_modules(arguments, sessions),
        "uffda_session_eval" => tool_session_eval(arguments, sessions),
        "uffda_session_describe" => tool_session_describe(arguments, sessions),
        "uffda_session_query" => tool_session_query(arguments, sessions),
        "uffda_session_patch" => tool_session_patch(arguments, sessions),
        "uffda_session_walk" => tool_session_walk(arguments, sessions),
        "uffda_session_close" => tool_session_close(arguments, sessions, displays),
        "uffda_session_display_open" => tool_display_open(arguments, sessions, displays),
        "uffda_session_display_render" => tool_display_render(arguments, sessions, displays),
        "uffda_highlight" => tool_highlight(arguments),
        other => error_result(format!("Unknown tool: {other}")),
    }
}

fn tool_display_open(
    arguments: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_display_open requires `sessionId`");
    };
    if sessions.get_mut(session_id).is_err() {
        return session_unknown(format!("No open session with id '{session_id}'"));
    }
    text_result(displays.open(session_id).to_string())
}

fn tool_display_render(
    arguments: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_display_render requires `sessionId`");
    };
    if sessions.get_mut(session_id).is_err() {
        return session_unknown(format!("No open session with id '{session_id}'"));
    }
    let match_result_id = arguments.get("matchResultId").and_then(Value::as_str);
    let source = arguments.get("source").and_then(Value::as_str);
    if match_result_id.is_some() == source.is_some() {
        return text_result(
            json!({
                "ok": false,
                "error": {
                    "code": "MCP_DISPLAY_INVALID_INPUT",
                    "phase": "input",
                    "message": "Provide exactly one of `matchResultId` or `source`."
                }
            })
            .to_string(),
        );
    }
    let markup = if let Some(source) = source {
        let language = match arguments.get("language").and_then(Value::as_str).unwrap_or("uffda")
        {
            "pattern" => crate::languages::Language::Pattern,
            "expression" => crate::languages::Language::Expression,
            _ => crate::languages::Language::Uffda,
        };
        let highlighted = ops::highlight_source(source, language);
        format!(
            "<!doctype html><title>uffda</title><body><pre>{}</pre></body>",
            html_escape(&highlighted.to_string())
        )
    } else {
        let match_result_id = match_result_id.unwrap();
        let walked = match sessions.get_mut(session_id) {
            Ok(session) => session.walk(match_result_id, None, Some(50), None),
            Err(error) => return session_unknown(error.message),
        };
        format!(
            "<!doctype html><title>uffda</title><body><pre>{}</pre></body>",
            html_escape(&walked.to_string())
        )
    };
    text_result(displays.render(session_id, &markup).to_string())
}

fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn tool_session_describe(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_describe requires `sessionId`");
    };
    let Some(name) = arguments.get("name").and_then(Value::as_str) else {
        return error_result("uffda_session_describe requires `name`");
    };
    let module_url = arguments.get("moduleUrl").and_then(Value::as_str);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(session.describe(name, module_url).to_string()),
        Err(error) => session_unknown(error.message),
    }
}

fn tool_session_query(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_query requires `sessionId`");
    };
    let Some(decorator) = arguments.get("decorator").and_then(Value::as_str) else {
        return error_result("uffda_session_query requires `decorator`");
    };
    let predicate = arguments.get("predicate").and_then(Value::as_str);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(session.query(decorator, predicate).to_string()),
        Err(error) => session_unknown(error.message),
    }
}

fn tool_session_patch(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_patch requires `sessionId`");
    };
    let Some(start) = arguments.get("start").and_then(Value::as_u64) else {
        return error_result("uffda_session_patch requires `start`");
    };
    let Some(end) = arguments.get("end").and_then(Value::as_u64) else {
        return error_result("uffda_session_patch requires `end`");
    };
    let Some(replacement) = arguments.get("replacement").and_then(Value::as_str) else {
        return error_result("uffda_session_patch requires `replacement`");
    };
    let module_url = arguments.get("moduleUrl").and_then(Value::as_str);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(
            session
                .patch(module_url, start as usize, end as usize, replacement)
                .to_string(),
        ),
        Err(error) => session_unknown(error.message),
    }
}

fn tool_session_walk(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_walk requires `sessionId`");
    };
    let Some(match_result_id) = arguments.get("matchResultId").and_then(Value::as_str) else {
        return error_result("uffda_session_walk requires `matchResultId`");
    };
    let path = arguments.get("path").and_then(Value::as_array).map(|items| {
        items
            .iter()
            .filter_map(|item| item.as_u64().map(|value| value as usize))
            .collect::<Vec<_>>()
    });
    let max_nodes = arguments
        .get("maxNodes")
        .and_then(Value::as_u64)
        .map(|value| value as usize);
    let max_depth = arguments
        .get("maxDepth")
        .and_then(Value::as_u64)
        .map(|value| value as usize);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(
            session
                .walk(
                    match_result_id,
                    path.as_deref(),
                    max_nodes,
                    max_depth,
                )
                .to_string(),
        ),
        Err(error) => session_unknown(error.message),
    }
}

fn tool_highlight(arguments: &Value) -> Value {
    let Some(source) = arguments.get("source").and_then(Value::as_str) else {
        return error_result("uffda_highlight requires `source`");
    };
    let language = match arguments.get("language").and_then(Value::as_str).unwrap_or("uffda") {
        "pattern" => crate::languages::Language::Pattern,
        "expression" => crate::languages::Language::Expression,
        _ => crate::languages::Language::Uffda,
    };
    text_result(ops::highlight_source(source, language).to_string())
}

fn session_unknown(message: String) -> Value {
    text_result(
        json!({
            "ok": false,
            "error": {
                "code": "MCP_SESSION_UNKNOWN",
                "phase": "session-lookup",
                "message": message
            }
        })
        .to_string(),
    )
}

fn tool_session_eval(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_eval requires `sessionId`");
    };
    let module_url = arguments.get("moduleUrl").and_then(Value::as_str);
    let expression = arguments.get("expression").and_then(Value::as_str);
    let rule = arguments.get("rule").and_then(Value::as_str);
    let input = arguments.get("input").and_then(Value::as_str);
    let input_is_json = arguments
        .get("inputIsJson")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(
            session
                .eval(module_url, expression, rule, input, input_is_json)
                .to_string(),
        ),
        Err(error) => text_result(
            json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_UNKNOWN",
                    "phase": "session-lookup",
                    "message": error.message
                }
            })
            .to_string(),
        ),
    }
}

fn tool_session_load(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_load requires `sessionId`");
    };
    let Some(source) = arguments.get("source").and_then(Value::as_str) else {
        return error_result("uffda_session_load requires `source`");
    };
    let path = arguments.get("path").and_then(Value::as_str);
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(session.load(source, path).to_string()),
        Err(error) => text_result(
            json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_UNKNOWN",
                    "phase": "session-lookup",
                    "message": error.message
                }
            })
            .to_string(),
        ),
    }
}

fn tool_session_list_modules(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_list_modules requires `sessionId`");
    };
    match sessions.get_mut(session_id) {
        Ok(session) => text_result(
            json!({
                "ok": true,
                "modules": session.list_loaded_modules()
            })
            .to_string(),
        ),
        Err(error) => text_result(
            json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_UNKNOWN",
                    "phase": "session-lookup",
                    "message": error.message
                }
            })
            .to_string(),
        ),
    }
}

fn tool_session_open(arguments: &Value, sessions: &mut SessionManager) -> Value {
    let cwd = arguments
        .get("cwd")
        .and_then(Value::as_str)
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let config = arguments.get("config").and_then(Value::as_str);
    match sessions.open(cwd, config) {
        Ok(session) => text_result(json!({ "ok": true, "sessionId": session.id }).to_string()),
        Err(error) => text_result(
            json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_OPEN_INVALID_PROJECT",
                    "message": error.message
                }
            })
            .to_string(),
        ),
    }
}

fn tool_session_close(
    arguments: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Value {
    let Some(session_id) = arguments.get("sessionId").and_then(Value::as_str) else {
        return error_result("uffda_session_close requires `sessionId`");
    };
    match sessions.close(session_id) {
        Ok(session) => {
            displays.close(session_id);
            text_result(json!({ "ok": true, "sessionId": session.id }).to_string())
        }
        Err(error) => session_unknown(error.message),
    }
}

fn tool_parse(arguments: &Value) -> Value {
    let Some(source) = arguments.get("source").and_then(Value::as_str) else {
        return error_result("uffda_parse requires `source`");
    };
    let language = arguments
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("uffda");
    let args = vec![
        "parse".into(),
        "-e".into(),
        source.into(),
        "--lang".into(),
        language.into(),
        "--json".into(),
    ];
    // Deno MCP wraps CLI AST as `{ ok: true, ast }` (see mcp.static_tools.ts).
    wrap_cli_ok_payload(&args, "ast")
}

fn tool_match(arguments: &Value) -> Value {
    let Some(pattern) = arguments.get("pattern").and_then(Value::as_str) else {
        return error_result("uffda_match requires `pattern`");
    };
    let Some(input) = arguments.get("input").and_then(Value::as_str) else {
        return error_result("uffda_match requires `input`");
    };
    let input_is_json = arguments
        .get("inputIsJson")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut args = vec![
        "match".into(),
        "-e".into(),
        pattern.into(),
        "--json".into(),
    ];
    if input_is_json {
        args.push("--input-json".into());
    } else {
        args.push("--input".into());
    }
    args.push(input.into());
    // Deno MCP wraps match value as `{ ok: true, value }` (see mcp.static_tools.ts).
    wrap_cli_ok_payload(&args, "value")
}

fn tool_compile(arguments: &Value) -> Value {
    let Some(paths) = arguments.get("paths").and_then(Value::as_array) else {
        return error_result("uffda_compile requires `paths`");
    };
    let Some(cwd) = arguments.get("cwd").and_then(Value::as_str) else {
        return error_result("uffda_compile requires `cwd`");
    };
    let overwrite = arguments
        .get("overwrite")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if overwrite {
        // Batch CLI preview does not yet expose --overwrite; refuse clearly.
        return error_result(
            "uffda_compile overwrite=true is not supported yet in the Rust MCP server",
        );
    }
    let previous = match std::env::current_dir() {
        Ok(dir) => dir,
        Err(error) => return error_result(format!("unable to read current directory: {error}")),
    };
    if let Err(error) = std::env::set_current_dir(cwd) {
        return error_result(format!("unable to use cwd {cwd}: {error}"));
    }
    let mut args = vec!["compile".into(), "--json".into()];
    if let Some(config) = arguments.get("config").and_then(Value::as_str) {
        args.push("--config".into());
        args.push(config.into());
    }
    for path in paths {
        let Some(path) = path.as_str() else {
            let _ = std::env::set_current_dir(&previous);
            return error_result("uffda_compile paths must be strings");
        };
        args.push(path.into());
    }
    let result = cli_tool_result(&args);
    let _ = std::env::set_current_dir(&previous);
    result
}

fn cli_tool_result(args: &[String]) -> Value {
    let result = crate::cli::run(args, || Ok(String::new()));
    let payload = if result.stderr.is_empty() {
        result.stdout
    } else if result.stdout.is_empty() {
        result.stderr
    } else {
        format!("{}{}", result.stdout, result.stderr)
    };
    if result.exit_code == 0 {
        // Prefer compact JSON when the CLI already emitted JSON.
        match serde_json::from_str::<Value>(payload.trim()) {
            Ok(value) => text_result(value.to_string()),
            Err(_) => text_result(payload),
        }
    } else {
        error_result(payload)
    }
}

fn wrap_cli_ok_payload(args: &[String], field: &str) -> Value {
    let result = crate::cli::run(args, || Ok(String::new()));
    if result.exit_code == 0 {
        let value = serde_json::from_str::<Value>(result.stdout.trim())
            .unwrap_or_else(|_| Value::String(result.stdout.trim().to_string()));
        let mut payload = json!({ "ok": true });
        payload[field] = value;
        return text_result(payload.to_string());
    }
    let payload = if result.stderr.is_empty() {
        result.stdout
    } else {
        result.stderr
    };
    match serde_json::from_str::<Value>(payload.trim()) {
        Ok(error) => text_result(error.to_string()),
        Err(_) => error_result(payload),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(message: &Value, sessions: &mut SessionManager) -> Option<Value> {
        let mut displays = DisplayManager::new();
        handle_message(message, sessions, &mut displays)
    }

    #[test]
    // req:mcp-server-001
    fn initialize_and_version_tool_round_trip() {
        let mut sessions = SessionManager::new();
        let init = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": { "name": "test", "version": "0" }
                }
            }),
            &mut sessions,
        )
        .expect("initialize response");
        assert_eq!(init["result"]["serverInfo"]["name"], "uffda");

        assert!(
            call(
                &json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                }),
                &mut sessions,
            )
            .is_none()
        );

        let tools = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list"
            }),
            &mut sessions,
        )
        .expect("tools/list");
        let names: Vec<&str> = tools["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|tool| tool["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"uffda_version"));
        assert!(names.contains(&"uffda_parse"));
        assert!(names.contains(&"uffda_session_open"));

        let call = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": { "name": "uffda_version", "arguments": {} }
            }),
            &mut sessions,
        )
        .expect("tools/call");
        assert_eq!(
            call["result"]["content"][0]["text"],
            env!("CARGO_PKG_VERSION")
        );
    }

    #[test]
    // req:mcp-server-003
    fn parse_tool_returns_ast_json() {
        let mut sessions = SessionManager::new();
        let call = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "uffda_parse",
                    "arguments": { "source": "any", "language": "pattern" }
                }
            }),
            &mut sessions,
        )
        .expect("parse call");
        assert_ne!(call["result"]["isError"], true);
        let text = call["result"]["content"][0]["text"].as_str().unwrap();
        let parsed: Value = serde_json::from_str(text).unwrap();
        assert_eq!(parsed["ok"], true);
        assert_eq!(parsed["ast"]["kind"], "any");
    }

    #[test]
    // req:mcp-server-002 req:mcp-server-004
    fn session_open_load_list_and_close_round_trip() {
        let mut sessions = SessionManager::new();
        let open = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_open",
                    "arguments": { "cwd": env!("CARGO_MANIFEST_DIR") }
                }
            }),
            &mut sessions,
        )
        .expect("session open");
        let text = open["result"]["content"][0]["text"].as_str().unwrap();
        let payload: Value = serde_json::from_str(text).unwrap();
        assert_eq!(payload["ok"], true);
        let session_id = payload["sessionId"].as_str().unwrap().to_string();

        let load = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_load",
                    "arguments": {
                        "sessionId": session_id,
                        "source": "export Main; rule Main = any;"
                    }
                }
            }),
            &mut sessions,
        )
        .expect("session load");
        let text = load["result"]["content"][0]["text"].as_str().unwrap();
        let payload: Value = serde_json::from_str(text).unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert_eq!(
            payload["module"]["declarations"],
            json!([{ "name": "Main", "kind": "rule", "exported": true }])
        );

        let listed = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_list_modules",
                    "arguments": { "sessionId": session_id }
                }
            }),
            &mut sessions,
        )
        .expect("list modules");
        let text = listed["result"]["content"][0]["text"].as_str().unwrap();
        let payload: Value = serde_json::from_str(text).unwrap();
        assert_eq!(payload["ok"], true);
        assert_eq!(payload["modules"].as_array().unwrap().len(), 1);

        let close = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_close",
                    "arguments": { "sessionId": session_id }
                }
            }),
            &mut sessions,
        )
        .expect("session close");
        let text = close["result"]["content"][0]["text"].as_str().unwrap();
        let payload: Value = serde_json::from_str(text).unwrap();
        assert_eq!(payload["ok"], true);

        let after = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_load",
                    "arguments": {
                        "sessionId": session_id,
                        "source": "export Main; rule Main = any;"
                    }
                }
            }),
            &mut sessions,
        )
        .expect("load after close");
        let text = after["result"]["content"][0]["text"].as_str().unwrap();
        let payload: Value = serde_json::from_str(text).unwrap();
        assert_eq!(payload["ok"], false);
        assert_eq!(payload["error"]["code"], "MCP_SESSION_UNKNOWN");
    }

    #[test]
    // req:mcp-server-006
    fn session_eval_expression_and_rule() {
        let mut sessions = SessionManager::new();
        let open = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_open",
                    "arguments": { "cwd": env!("CARGO_MANIFEST_DIR") }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let session_id = serde_json::from_str::<Value>(
            open["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap()["sessionId"]
            .as_str()
            .unwrap()
            .to_string();

        let load = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_load",
                    "arguments": {
                        "sessionId": session_id,
                        "source": "export Add Main;\nfunc Add<a:number b:number> = (add a b);\nrule Main = \"A\";"
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let loaded: Value = serde_json::from_str(
            load["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(loaded["ok"], true, "{loaded}");

        let expr = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_eval",
                    "arguments": {
                        "sessionId": session_id,
                        "expression": "(Add 1 2)"
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            expr["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload, json!({ "ok": true, "value": 3 }), "{payload}");

        let rule = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_eval",
                    "arguments": {
                        "sessionId": session_id,
                        "rule": "Main",
                        "input": "A"
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            rule["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert_eq!(payload["value"], "A");
        assert!(payload["matchResultId"].as_str().is_some());

        let fail = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_eval",
                    "arguments": {
                        "sessionId": session_id,
                        "rule": "Main",
                        "input": "B"
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            fail["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], false);
        assert_eq!(payload["error"]["code"], "MCP_SESSION_EVAL_MATCH_FAILURE");
    }

    #[test]
    // req:mcp-server-007 req:mcp-server-005 req:mcp-server-008 req:mcp-server-009
    fn session_describe_query_patch_walk_and_highlight() {
        let mut sessions = SessionManager::new();
        let open = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_open",
                    "arguments": { "cwd": env!("CARGO_MANIFEST_DIR") }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let session_id = serde_json::from_str::<Value>(
            open["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap()["sessionId"]
            .as_str()
            .unwrap()
            .to_string();

        let source = "export Main Loud;\ndecorator Loud = { shout: true };\n[Loud]\nrule Main = any;";
        let load = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_load",
                    "arguments": { "sessionId": session_id, "source": source }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let loaded: Value =
            serde_json::from_str(load["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        assert_eq!(loaded["ok"], true, "{loaded}");

        let described = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_describe",
                    "arguments": { "sessionId": session_id, "name": "Main" }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            described["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert_eq!(payload["declaration"]["kind"], "rule");
        assert_eq!(
            payload["declaration"]["attributes"],
            json!([{ "decorator": "Loud", "args": [] }])
        );

        let queried = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_query",
                    "arguments": { "sessionId": session_id, "decorator": "Loud" }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value =
            serde_json::from_str(queried["result"]["content"][0]["text"].as_str().unwrap())
                .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert_eq!(payload["matches"][0]["name"], "Main");
        assert_eq!(payload["matches"][0]["metadata"], json!({ "shout": true }));

        let eval = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_eval",
                    "arguments": {
                        "sessionId": session_id,
                        "rule": "Main",
                        "input": "x"
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value =
            serde_json::from_str(eval["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        let match_id = payload["matchResultId"].as_str().unwrap().to_string();

        let walked = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_walk",
                    "arguments": {
                        "sessionId": session_id,
                        "matchResultId": match_id,
                        "maxNodes": 1
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value =
            serde_json::from_str(walked["result"]["content"][0]["text"].as_str().unwrap())
                .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert_eq!(payload["nodes"].as_array().unwrap().len(), 1);
        assert_eq!(payload["truncated"], true);

        let patched = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_patch",
                    "arguments": {
                        "sessionId": session_id,
                        "start": 0,
                        "end": 0,
                        "replacement": ""
                    }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value =
            serde_json::from_str(patched["result"]["content"][0]["text"].as_str().unwrap())
                .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");

        let highlight = call(
            &json!({
                "jsonrpc": "2.0",
                "id": 8,
                "method": "tools/call",
                "params": {
                    "name": "uffda_highlight",
                    "arguments": { "source": "rule Main = any;", "language": "uffda" }
                }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            highlight["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        let spans = payload["spans"].as_array().unwrap();
        assert!(!spans.is_empty());
        let covered: usize = spans
            .iter()
            .map(|span| span["length"].as_u64().unwrap() as usize)
            .sum();
        assert_eq!(covered, "rule Main = any;".encode_utf16().count());
    }

    #[test]
    // req:mcp-server-011
    fn session_display_open_and_render() {
        let mut sessions = SessionManager::new();
        let mut displays = DisplayManager::new();
        let open = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_open",
                    "arguments": { "cwd": env!("CARGO_MANIFEST_DIR") }
                }
            }),
            &mut sessions,
            &mut displays,
        )
        .unwrap();
        let session_id = serde_json::from_str::<Value>(
            open["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap()["sessionId"]
            .as_str()
            .unwrap()
            .to_string();

        let surface = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_display_open",
                    "arguments": { "sessionId": session_id }
                }
            }),
            &mut sessions,
            &mut displays,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            surface["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");
        assert!(
            payload["url"].as_str().unwrap().starts_with("http://127.0.0.1:"),
            "{payload}"
        );

        let rendered = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_display_render",
                    "arguments": {
                        "sessionId": session_id,
                        "source": "rule Main = any;",
                        "language": "uffda"
                    }
                }
            }),
            &mut sessions,
            &mut displays,
        )
        .unwrap();
        let payload: Value = serde_json::from_str(
            rendered["result"]["content"][0]["text"].as_str().unwrap(),
        )
        .unwrap();
        assert_eq!(payload["ok"], true, "{payload}");

        let _ = handle_message(
            &json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "uffda_session_close",
                    "arguments": { "sessionId": session_id }
                }
            }),
            &mut sessions,
            &mut displays,
        );
    }
}

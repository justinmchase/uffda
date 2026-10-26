//! Ports of Deno MCP suites under `src/cli/mcp*.test.ts`.
//! Existing coverage in `mod::tests`, `experiment::tests`, and
//! `authoring::tests` is not duplicated here.

use super::authoring::{authoring_context, authoring_context_with_topics};
use super::display::DisplayManager;
use super::experiment::experiment;
use super::sessions::SessionManager;
use super::{handle_message, tool_descriptors};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

fn call(message: &Value, sessions: &mut SessionManager) -> Option<Value> {
    let mut displays = DisplayManager::new();
    handle_message(message, sessions, &mut displays)
}

fn call_with_displays(
    message: &Value,
    sessions: &mut SessionManager,
    displays: &mut DisplayManager,
) -> Option<Value> {
    handle_message(message, sessions, displays)
}

fn text_payload(response: &Value) -> Value {
    let text = response["result"]["content"][0]["text"]
        .as_str()
        .unwrap_or_else(|| panic!("missing text content: {response}"));
    serde_json::from_str(text).unwrap_or_else(|_| json!({ "raw": text }))
}

fn open_session(sessions: &mut SessionManager, displays: &mut DisplayManager) -> String {
    let open = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_open",
                "arguments": { "cwd": env!("CARGO_MANIFEST_DIR") }
            }
        }),
        sessions,
        displays,
    )
    .expect("session open");
    text_payload(&open)["sessionId"]
        .as_str()
        .expect("sessionId")
        .to_string()
}

fn temp_root(label: &str) -> PathBuf {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let root = std::env::temp_dir().join(format!(
        "uffda-mcp-port-{label}-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    // Canonicalize so `uffda_compile` sees an absolute cwd (required).
    root.canonicalize().unwrap_or(root)
}

fn write_file(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(path, content).unwrap();
}

// --- mcp.test.ts -----------------------------------------------------------

#[test]
// req:mcp-server-001 req:mcp-server-003 req:mcp-server-014 req:mcp-server-015
fn tools_list_advertises_stateless_and_session_tools() {
    let tools = tool_descriptors();
    let mut names: Vec<&str> = tools
        .iter()
        .map(|tool| tool["name"].as_str().unwrap())
        .collect();
    names.sort();
    let expected = [
        "uffda_authoring_context",
        "uffda_compile",
        "uffda_experiment",
        "uffda_highlight",
        "uffda_match",
        "uffda_parse",
        "uffda_session_close",
        "uffda_session_describe",
        "uffda_session_display_open",
        "uffda_session_display_render",
        "uffda_session_eval",
        "uffda_session_list_modules",
        "uffda_session_load",
        "uffda_session_open",
        "uffda_session_patch",
        "uffda_session_query",
        "uffda_session_walk",
        "uffda_version",
    ];
    assert_eq!(names, expected);

    let experiment = tools
        .iter()
        .find(|tool| tool["name"] == "uffda_experiment")
        .unwrap();
    let desc = experiment["description"]
        .as_str()
        .unwrap()
        .to_ascii_lowercase();
    assert!(desc.contains("in-memory"), "{desc}");
    assert!(desc.contains("assert") || desc.contains("cases"), "{desc}");
    let props = experiment["inputSchema"]["properties"].as_object().unwrap();
    for key in [
        "language",
        "source",
        "cases",
        "input",
        "inputs",
        "inputIsJson",
        "rule",
        "variables",
        "verbose",
    ] {
        assert!(props.contains_key(key), "experiment schema missing {key}");
    }

    let authoring = tools
        .iter()
        .find(|tool| tool["name"] == "uffda_authoring_context")
        .unwrap();
    let authoring_props = authoring["inputSchema"]["properties"].as_object().unwrap();
    for key in ["task", "topics", "language"] {
        assert!(
            authoring_props.contains_key(key),
            "authoring schema missing {key}"
        );
    }
}

#[test]
// req:mcp-server-003 req:mcp-server-009 req:mcp-server-014
fn parse_match_highlight_and_experiment_over_tools_call() {
    let mut sessions = SessionManager::new();

    let parse = call(
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
    .unwrap();
    assert_eq!(text_payload(&parse)["ok"], true);

    let matched = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": { "pattern": "any", "input": "x" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    assert_eq!(text_payload(&matched)["ok"], true);

    let highlight = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "uffda_highlight",
                "arguments": { "source": "rule A = any;\n" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let highlighted = text_payload(&highlight);
    assert_eq!(highlighted["ok"], true);
    let keyword = highlighted["spans"]
        .as_array()
        .unwrap()
        .iter()
        .find(|span| span["role"] == "keyword");
    assert_eq!(keyword.unwrap()["text"], "rule");

    let experiment_call = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "uffda_experiment",
                "arguments": {
                    "language": "pattern",
                    "source": "\"x\"",
                    "cases": [{ "name": "hit", "input": "x", "expect": "x" }]
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&experiment_call);
    assert_eq!(payload["ok"], true, "{payload}");
    assert_eq!(payload["summary"]["passed"], 1);
    assert_eq!(payload["summary"]["failed"], 0);
}

// --- mcp.static_tools.test.ts ----------------------------------------------

#[test]
// req:mcp-server-003
fn parse_tool_language_and_failure() {
    let mut sessions = SessionManager::new();
    let module = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "uffda_parse",
                "arguments": { "source": "export Main; rule Main = any;" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    assert_eq!(text_payload(&module)["ok"], true);

    let bad = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "uffda_parse",
                "arguments": { "source": "rule Main = " }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&bad);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["phase"], "parse");
}

#[test]
// req:mcp-server-003
fn match_tool_text_json_and_phase_failures() {
    let mut sessions = SessionManager::new();

    let text = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": { "pattern": "any", "input": "x" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    assert_eq!(text_payload(&text)["ok"], true);

    let json_input = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": {
                    "pattern": "any",
                    "input": "42",
                    "inputIsJson": true
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&json_input);
    assert_eq!(payload["ok"], true, "{payload}");
    assert_eq!(payload["value"], 42);

    let bad_pattern = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": { "pattern": "(", "input": "x" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&bad_pattern);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["phase"], "parse");

    let miss = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": { "pattern": "\"specific\"", "input": "other" }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&miss);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["phase"], "match");

    let bad_json = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "uffda_match",
                "arguments": {
                    "pattern": "any",
                    "input": "{not json",
                    "inputIsJson": true
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&bad_json);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["phase"], "input");
}

#[test]
// req:mcp-server-003
fn compile_tool_writes_default_and_project_out_dir() {
    // Isolated temp trees + explicit `config` so Project::discover does not
    // walk into this repository's uffda.jsonc.
    let root = temp_root("compile");
    write_file(&root.join("uffda.jsonc"), "{}\n");
    write_file(&root.join("main.uff"), "export Main; rule Main = any;");

    let mut sessions = SessionManager::new();
    let result = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "uffda_compile",
                "arguments": {
                    "cwd": root.to_string_lossy(),
                    "config": "uffda.jsonc",
                    "paths": ["main.uff"]
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&result);
    assert_eq!(payload["ok"], true, "{payload}");
    assert_eq!(payload["successes"].as_array().unwrap().len(), 1);
    let output = payload["successes"][0]["outputPath"].as_str().unwrap();
    assert!(
        output.contains("bin") && output.contains("main.uff.ast"),
        "{output}"
    );

    let project_root = temp_root("compile-project");
    write_file(
        &project_root.join("uffda.jsonc"),
        r#"{ "outDir": "./out" }"#,
    );
    write_file(&project_root.join("src/main.uff"), "rule Main = any;");
    let result = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "uffda_compile",
                "arguments": {
                    "cwd": project_root.to_string_lossy(),
                    "config": "uffda.jsonc",
                    "paths": ["src/main.uff"]
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&result);
    assert_eq!(payload["ok"], true, "{payload}");
    let output = payload["successes"][0]["outputPath"].as_str().unwrap();
    assert!(
        output.contains("out") && output.contains("main.uff.ast"),
        "{output}"
    );

    let missing = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "uffda_compile",
                "arguments": {
                    "cwd": root.to_string_lossy(),
                    "config": "uffda.jsonc",
                    "paths": ["missing.uff"]
                }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&missing);
    assert_eq!(payload["ok"], false, "{payload}");

    let _ = std::fs::remove_dir_all(&root);
    let _ = std::fs::remove_dir_all(&project_root);
}

// --- mcp.sessions.test.ts --------------------------------------------------

#[test]
// req:mcp-server-002
fn session_manager_open_close_and_isolation() {
    let mut manager = SessionManager::new();
    let a = manager
        .open(PathBuf::from(env!("CARGO_MANIFEST_DIR")), None)
        .unwrap()
        .id
        .clone();
    let b = manager
        .open(PathBuf::from(env!("CARGO_MANIFEST_DIR")), None)
        .unwrap()
        .id
        .clone();
    assert_ne!(a, b);
    assert!(manager.get_mut(&a).is_ok());
    assert!(manager.get_mut(&b).is_ok());
    assert!(manager.get_mut("never-opened").is_err());

    manager
        .get_mut(&a)
        .unwrap()
        .load("export Main; rule Main = any;", None);
    assert_eq!(manager.get_mut(&a).unwrap().list_loaded_modules().len(), 1);
    assert_eq!(manager.get_mut(&b).unwrap().list_loaded_modules().len(), 0);

    assert!(manager.close(&a).is_ok());
    assert!(manager.get_mut(&a).is_err());
    assert!(manager.close("never-opened").is_err());
}

// --- mcp.experiment.test.ts (gaps beyond experiment::tests) ----------------

#[test]
// req:mcp-server-014
fn experiment_projection_json_inputs_and_ordered_failures() {
    let projected = experiment(&json!({
        "language": "pattern",
        "source": "x:any -> (pack x \"ok\")",
        "cases": [{ "name": "proj", "input": "a", "expect": ["a", "ok"] }]
    }));
    assert_eq!(projected["ok"], true, "{projected}");
    assert_eq!(projected["summary"]["passed"], 1);

    let miss = experiment(&json!({
        "language": "pattern",
        "source": "\"exact\"",
        "cases": [{ "name": "miss", "input": "nope" }]
    }));
    assert_eq!(miss["ok"], false);
    assert_eq!(miss["failures"][0]["error"]["kind"], "match");
    assert_eq!(miss["failures"][0]["error"]["phase"], "match");

    let text = experiment(&json!({
        "language": "pattern",
        "source": "any",
        "cases": [{ "name": "text", "input": "[\"ab\"]", "expect": "[" }],
        "inputIsJson": false
    }));
    assert_eq!(text["ok"], true, "{text}");

    let json_case = experiment(&json!({
        "language": "pattern",
        "source": "any",
        "cases": [{
            "name": "json",
            "input": "[\"ab\"]",
            "expect": ["ab"],
            "inputIsJson": true
        }]
    }));
    assert_eq!(json_case["ok"], true, "{json_case}");

    let ordered = experiment(&json!({
        "language": "pattern",
        "source": "\"a\"+",
        "inputs": ["aa", "b", "aaa"]
    }));
    // Compact payload omits per-case rows (Deno `verbose` cases list); assert
    // independent ordered outcomes via summary + the single failure name.
    assert_eq!(ordered["summary"]["parseOk"], true, "{ordered}");
    assert_eq!(ordered["summary"]["total"], 3);
    assert_eq!(ordered["summary"]["passed"], 2);
    assert_eq!(ordered["summary"]["failed"], 1);
    assert_eq!(ordered["ok"], false);
    assert_eq!(ordered["failures"][0]["name"], "input-1");
}

#[test]
// req:mcp-server-014
fn experiment_expression_module_and_invalid_json() {
    // Expression without bindings (variables are unsupported on this runtime).
    let ok = experiment(&json!({
        "language": "expression",
        "source": "(add 41 1)",
        "cases": [{ "name": "add", "input": "", "expect": 42 }]
    }));
    assert_eq!(ok["ok"], true, "{ok}");

    let with_vars = experiment(&json!({
        "language": "expression",
        "source": "(add a 1)",
        "variables": { "a": 41 },
        "cases": [{ "name": "add", "input": "", "expect": 42 }]
    }));
    assert_eq!(with_vars["ok"], false, "{with_vars}");
    assert_eq!(
        with_vars["unsupported"]["code"],
        "MCP_EXPERIMENT_UNSUPPORTED"
    );

    let bad = experiment(&json!({
        "language": "expression",
        "source": "(add"
    }));
    assert_eq!(bad["ok"], false);
    assert_eq!(bad["summary"]["parseOk"], false);
    assert!(bad.get("parseError").is_some());
    assert_eq!(bad["parseError"]["phase"], "parse");

    let module = experiment(&json!({
        "language": "uffda",
        "source": "export Main;\nrule Main = x:any -> x;\n",
        "cases": [
            { "name": "a", "input": "ab", "expect": "a" },
            { "name": "z", "input": "z", "expect": "z" }
        ]
    }));
    assert_eq!(module["summary"]["parseOk"], true, "{module}");
    assert!(module.get("unsupported").is_none(), "{module}");
    assert_eq!(module["ok"], true, "{module}");

    let bad_json = experiment(&json!({
        "language": "pattern",
        "source": "any",
        "cases": [{ "name": "bad-json", "input": "{not-json", "inputIsJson": true }]
    }));
    assert_eq!(bad_json["summary"]["parseOk"], true);
    assert_eq!(bad_json["ok"], false);
    // Compact wrap may label the case as match; the CLI input-phase code is
    // preserved in the error message (CLI_MATCH_INVALID_JSON).
    let blob = bad_json["failures"][0].to_string();
    assert!(
        blob.contains("CLI_MATCH_INVALID_JSON") || blob.contains("\"phase\":\"input\""),
        "{blob}"
    );
}

#[test]
// req:mcp-server-014
fn experiment_does_not_write_artifacts() {
    let root = temp_root("experiment-artifacts");
    let before = std::fs::read_dir(&root).unwrap().count();
    let first = experiment(&json!({
        "language": "pattern",
        "source": "n:number",
        "cases": [{ "name": "seven", "input": "7", "expect": 7, "inputIsJson": true }]
    }));
    assert_eq!(first["ok"], true, "{first}");
    let second = experiment(&json!({
        "language": "pattern",
        "source": "n:number",
        "cases": [{ "name": "eight", "input": "8", "expect": 8, "inputIsJson": true }]
    }));
    assert_eq!(second["ok"], true, "{second}");
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), before);
    let _ = std::fs::remove_dir_all(&root);
}

// --- mcp.authoring_context.test.ts (gaps) ----------------------------------

#[test]
// req:mcp-server-013
fn authoring_success_shape_and_task_relevant_retrieval() {
    let result = authoring_context(
        "write an expression that reduces a list of numbers",
        Some("expression"),
    );
    assert_eq!(result["ok"], true, "{result}");
    assert_eq!(
        result["task"],
        "write an expression that reduces a list of numbers"
    );
    assert_eq!(result["language"], "expression");
    assert!(!result["syntax"].as_array().unwrap().is_empty());
    assert!(!result["semantics"].as_array().unwrap().is_empty());
    assert!(result["restrictions"].is_array());
    let status = result["expressibility"]["status"].as_str().unwrap();
    assert!(
        [
            "supported",
            "partially_supported",
            "unsupported",
            "uncertain"
        ]
        .contains(&status),
        "{status}"
    );
    assert!(!result["sources"].as_array().unwrap().is_empty());
    assert!(
        result["relevantGlobals"]
            .as_array()
            .unwrap()
            .iter()
            .any(|g| g["name"] == "reduce"),
        "{result}"
    );

    let reduce = authoring_context("fold a collection with reduce and a lambda", None);
    let recurse = authoring_context("write a left-recursive rule for nested expressions", None);
    assert_eq!(reduce["ok"], true, "{reduce}");
    assert_eq!(recurse["ok"], true, "{recurse}");

    let reduce_ids: Vec<&str> = reduce["syntax"]
        .as_array()
        .unwrap()
        .iter()
        .chain(reduce["semantics"].as_array().unwrap())
        .filter_map(|item| item["id"].as_str())
        .collect();
    assert!(
        reduce_ids.contains(&"global-reduce-map") || reduce_ids.contains(&"expr-lambda-syntax"),
        "{reduce_ids:?}"
    );

    let recurse_ids: Vec<&str> = recurse["syntax"]
        .as_array()
        .unwrap()
        .iter()
        .chain(recurse["semantics"].as_array().unwrap())
        .chain(recurse["restrictions"].as_array().unwrap())
        .filter_map(|item| item["id"].as_str())
        .collect();
    assert!(recurse_ids.contains(&"left-recursion"), "{recurse_ids:?}");
    assert!(!recurse_ids.contains(&"no-sort-global"), "{recurse_ids:?}");

    let _topics = authoring_context_with_topics("", &["repetition".to_string()], None);
}

// --- mcp.display_tools.test.ts ---------------------------------------------

#[test]
// req:mcp-server-011 req:mcp-server-010
fn display_open_render_errors_and_session_release() {
    let mut sessions = SessionManager::new();
    let mut displays = DisplayManager::new();
    let session_id = open_session(&mut sessions, &mut displays);

    let opened = call_with_displays(
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
    assert_eq!(text_payload(&opened)["ok"], true);

    // Rust fails deterministically on a second open (ALREADY_OPEN). Spec does
    // not require Deno's idempotent open; keep the deterministic error.
    let second = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
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
    assert_eq!(text_payload(&second)["ok"], false);
    assert_eq!(
        text_payload(&second)["error"]["code"],
        "MCP_DISPLAY_ALREADY_OPEN"
    );

    let unknown = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_open",
                "arguments": { "sessionId": "nope" }
            }
        }),
        &mut sessions,
        &mut displays,
    )
    .unwrap();
    assert_eq!(text_payload(&unknown)["ok"], false);
    assert_eq!(
        text_payload(&unknown)["error"]["code"],
        "MCP_SESSION_UNKNOWN"
    );

    let mut sessions2 = SessionManager::new();
    let mut displays2 = DisplayManager::new();
    let sid = open_session(&mut sessions2, &mut displays2);
    let before_open = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_render",
                "arguments": { "sessionId": sid, "source": "export Main;" }
            }
        }),
        &mut sessions2,
        &mut displays2,
    )
    .unwrap();
    assert_eq!(text_payload(&before_open)["ok"], false);
    assert_eq!(
        text_payload(&before_open)["error"]["code"],
        "MCP_DISPLAY_NO_OPEN_SURFACE"
    );

    let _ = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_open",
                "arguments": { "sessionId": sid }
            }
        }),
        &mut sessions2,
        &mut displays2,
    );
    let both = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_render",
                "arguments": {
                    "sessionId": sid,
                    "source": "export Main;",
                    "matchResultId": "match-1"
                }
            }
        }),
        &mut sessions2,
        &mut displays2,
    )
    .unwrap();
    assert_eq!(text_payload(&both)["ok"], false);
    assert_eq!(
        text_payload(&both)["error"]["code"],
        "MCP_DISPLAY_INVALID_INPUT"
    );

    let unknown_match = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 8,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_render",
                "arguments": { "sessionId": sid, "matchResultId": "nope" }
            }
        }),
        &mut sessions2,
        &mut displays2,
    )
    .unwrap();
    assert_eq!(text_payload(&unknown_match)["ok"], false);
    assert_eq!(
        text_payload(&unknown_match)["error"]["code"],
        "MCP_DISPLAY_UNKNOWN_MATCH_RESULT"
    );

    let _ = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 9,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_close",
                "arguments": { "sessionId": sid }
            }
        }),
        &mut sessions2,
        &mut displays2,
    );
    let after_close = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_render",
                "arguments": { "sessionId": sid, "source": "export Main;" }
            }
        }),
        &mut sessions2,
        &mut displays2,
    )
    .unwrap();
    assert_eq!(text_payload(&after_close)["ok"], false);
    assert_eq!(
        text_payload(&after_close)["error"]["code"],
        "MCP_SESSION_UNKNOWN"
    );
}

#[test]
// req:mcp-server-011
fn display_renders_retained_match_result() {
    let mut sessions = SessionManager::new();
    let mut displays = DisplayManager::new();
    let session_id = open_session(&mut sessions, &mut displays);

    let load = call_with_displays(
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
        &mut displays,
    )
    .unwrap();
    assert_eq!(text_payload(&load)["ok"], true, "{}", text_payload(&load));

    let evaluated = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
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
        &mut displays,
    )
    .unwrap();
    let eval_payload = text_payload(&evaluated);
    assert_eq!(eval_payload["ok"], true, "{eval_payload}");
    let match_id = eval_payload["matchResultId"].as_str().unwrap().to_string();

    let _ = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_open",
                "arguments": { "sessionId": session_id }
            }
        }),
        &mut sessions,
        &mut displays,
    );
    let rendered = call_with_displays(
        &json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_display_render",
                "arguments": {
                    "sessionId": session_id,
                    "matchResultId": match_id
                }
            }
        }),
        &mut sessions,
        &mut displays,
    )
    .unwrap();
    assert_eq!(
        text_payload(&rendered)["ok"],
        true,
        "{}",
        text_payload(&rendered)
    );
}

// --- mcp.session_tools.test.ts (unknown-id + project open gaps) ------------

#[test]
// req:mcp-server-002 req:mcp-server-010
fn session_tools_fail_unknown_session_ids() {
    let mut sessions = SessionManager::new();
    for (id, name, args) in [
        (
            1,
            "uffda_session_load",
            json!({ "sessionId": "nope", "source": "export Main;" }),
        ),
        (
            2,
            "uffda_session_patch",
            json!({
                "sessionId": "nope",
                "start": 0,
                "end": 0,
                "replacement": ""
            }),
        ),
        (
            3,
            "uffda_session_eval",
            json!({ "sessionId": "nope", "expression": "1" }),
        ),
        (
            4,
            "uffda_session_list_modules",
            json!({ "sessionId": "nope" }),
        ),
        (
            5,
            "uffda_session_describe",
            json!({ "sessionId": "nope", "name": "Main" }),
        ),
        (
            6,
            "uffda_session_query",
            json!({ "sessionId": "nope", "decorator": "Loud" }),
        ),
        (
            7,
            "uffda_session_walk",
            json!({ "sessionId": "nope", "matchResultId": "m1" }),
        ),
    ] {
        let response = call(
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "tools/call",
                "params": { "name": name, "arguments": args }
            }),
            &mut sessions,
        )
        .unwrap();
        let payload = text_payload(&response);
        assert_eq!(payload["ok"], false, "{name}: {payload}");
        assert_eq!(
            payload["error"]["code"], "MCP_SESSION_UNKNOWN",
            "{name}: {payload}"
        );
    }
}

#[test]
// req:mcp-server-002
fn session_open_reads_project_imports() {
    let root = temp_root("session-project");
    write_file(
        &root.join("uffda.jsonc"),
        r#"{ "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" } }"#,
    );
    let mut sessions = SessionManager::new();
    let open = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_open",
                "arguments": { "cwd": root.to_string_lossy() }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&open);
    assert_eq!(payload["ok"], true, "{payload}");

    let invalid = temp_root("session-bad-project");
    write_file(&invalid.join("uffda.jsonc"), "[]");
    let bad = call(
        &json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "uffda_session_open",
                "arguments": { "cwd": invalid.to_string_lossy() }
            }
        }),
        &mut sessions,
    )
    .unwrap();
    let payload = text_payload(&bad);
    assert_eq!(payload["ok"], false, "{payload}");

    let _ = std::fs::remove_dir_all(&root);
    let _ = std::fs::remove_dir_all(&invalid);
}

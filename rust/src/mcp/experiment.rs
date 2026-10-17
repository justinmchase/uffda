//! Stateless `uffda_experiment` — in-memory parse + match/eval without
//! persistent sessions or artifact writes (`req:mcp-server-014`).
//!
//! Pattern/expression runs reuse the same CLI `-e` paths as `uffda_match` /
//! `uffda_parse` (no artifact writes). Full modules with imports are rejected
//! for the run phase; self-contained modules use an ephemeral in-memory session
//! against the process cwd (no files created for the snippet itself).

use crate::languages::{Language, Languages};
use serde_json::{json, Value};

fn language_of(name: &str) -> Option<Language> {
    match name {
        "uffda" => Some(Language::Uffda),
        "pattern" => Some(Language::Pattern),
        "expression" => Some(Language::Expression),
        _ => None,
    }
}

fn samples(arguments: &Value) -> Vec<String> {
    if let Some(inputs) = arguments.get("inputs").and_then(Value::as_array) {
        return inputs
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect();
    }
    arguments
        .get("input")
        .and_then(Value::as_str)
        .map(|s| vec![s.to_string()])
        .unwrap_or_default()
}

fn has_import(ast: &crate::json::JsonValue) -> bool {
    let Some(crate::json::JsonValue::Array(declarations)) = ast.get("declarations") else {
        return false;
    };
    declarations.iter().any(|declaration| {
        match declaration.get("kind") {
            Some(crate::json::JsonValue::String(kind)) => kind == "import",
            _ => false,
        }
    })
}

fn wrap_cli_match_success(stdout: &str) -> Value {
    match serde_json::from_str::<Value>(stdout) {
        Ok(value) => {
            // Deno MCP match wraps as `{ ok: true, value }`; CLI emits the value.
            if value.get("ok").is_some() {
                value
            } else {
                json!({ "ok": true, "value": value })
            }
        }
        Err(error) => json!({
            "ok": false,
            "error": {
                "code": "CLI_MATCH_FAILURE",
                "phase": "match",
                "message": error.to_string(),
            }
        }),
    }
}

fn wrap_cli_failure(stdout: &str, stderr: &str, default_code: &str, phase: &str) -> Value {
    if let Ok(value) = serde_json::from_str::<Value>(stdout) {
        if value.get("error").is_some() || value.get("ok") == Some(&json!(false)) {
            return value;
        }
        if value.get("code").is_some() {
            return json!({ "ok": false, "error": value });
        }
    }
    json!({
        "ok": false,
        "error": {
            "code": default_code,
            "phase": phase,
            "message": if stderr.is_empty() { stdout } else { stderr },
        }
    })
}

/// Builds the `uffda_experiment` JSON payload.
pub fn experiment(arguments: &Value) -> Value {
    let language_name = arguments
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("uffda");
    let Some(source) = arguments.get("source").and_then(Value::as_str) else {
        return json!({
            "ok": false,
            "language": language_name,
            "parse": {
                "ok": false,
                "error": {
                    "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                    "phase": "validate",
                    "message": "uffda_experiment requires `source`",
                }
            }
        });
    };
    if source.trim().is_empty() {
        return json!({
            "ok": false,
            "language": language_name,
            "parse": {
                "ok": false,
                "error": {
                    "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                    "phase": "validate",
                    "message": "source must be a non-empty Uffda snippet",
                }
            }
        });
    }
    let Some(language) = language_of(language_name) else {
        return json!({
            "ok": false,
            "language": language_name,
            "parse": {
                "ok": false,
                "error": {
                    "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                    "phase": "validate",
                    "message": format!("unknown language: {language_name}"),
                }
            }
        });
    };

    let mut languages = match Languages::new() {
        Ok(languages) => languages,
        Err(error) => {
            return json!({
                "ok": false,
                "language": language_name,
                "parse": {
                    "ok": false,
                    "error": {
                        "code": "CLI_STREAM_PARSE_FAILURE",
                        "phase": "parse",
                        "message": error.to_string(),
                    }
                }
            });
        }
    };
    let parsed = match languages.parse_source(source, language) {
        Ok(parsed) if parsed.diagnostics.is_empty() => parsed,
        Ok(parsed) => {
            let diagnostics: Vec<Value> = parsed
                .diagnostics
                .iter()
                .map(|diagnostic| {
                    json!({
                        "code": "CLI_STREAM_PARSE_RECOVERED",
                        "phase": "parse",
                        "message": diagnostic.message,
                    })
                })
                .collect();
            return json!({
                "ok": false,
                "language": language_name,
                "parse": {
                    "ok": false,
                    "error": diagnostics.first().cloned().unwrap_or(json!({
                        "code": "CLI_STREAM_PARSE_RECOVERED",
                        "phase": "parse",
                        "message": "parse recovered",
                    })),
                    "diagnostics": diagnostics,
                }
            });
        }
        Err(error) => {
            return json!({
                "ok": false,
                "language": language_name,
                "parse": {
                    "ok": false,
                    "error": {
                        "code": "CLI_STREAM_PARSE_FAILURE",
                        "phase": "parse",
                        "message": error.to_string(),
                    }
                }
            });
        }
    };

    let parse_ok = json!({ "ok": true, "ast": parsed.value });
    let sample_list = samples(arguments);
    let input_is_json = arguments
        .get("inputIsJson")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    match language {
        Language::Pattern => {
            if sample_list.is_empty() {
                return json!({ "ok": true, "language": language_name, "parse": parse_ok });
            }
            let mut runs = Vec::new();
            let mut all_ok = true;
            for (index, sample) in sample_list.iter().enumerate() {
                let mut args = vec![
                    "match".to_string(),
                    "-e".to_string(),
                    source.to_string(),
                    "--json".to_string(),
                ];
                if input_is_json {
                    args.push("--input-json".to_string());
                } else {
                    args.push("--input".to_string());
                }
                args.push(sample.clone());
                let payload = crate::cli::run(&args, || Ok(String::new()));
                let body = if payload.exit_code == 0 {
                    wrap_cli_match_success(&payload.stdout)
                } else {
                    all_ok = false;
                    wrap_cli_failure(
                        &payload.stdout,
                        &payload.stderr,
                        "CLI_MATCH_FAILURE",
                        "match",
                    )
                };
                runs.push(json!({
                    "index": index,
                    "input": sample,
                    "inputIsJson": input_is_json,
                    "ok": body.get("ok") == Some(&json!(true)),
                    "value": body.get("value").cloned(),
                    "error": body.get("error").cloned(),
                    "diagnostics": body.get("diagnostics").cloned(),
                }));
                if body.get("ok") != Some(&json!(true)) {
                    all_ok = false;
                }
            }
            json!({
                "ok": all_ok,
                "language": language_name,
                "parse": parse_ok,
                "runs": runs,
            })
        }
        Language::Expression => {
            if arguments.get("variables").is_some() {
                return json!({
                    "ok": false,
                    "language": language_name,
                    "parse": parse_ok,
                    "unsupported": {
                        "code": "MCP_EXPERIMENT_UNSUPPORTED",
                        "phase": "execute",
                        "message": "Rust uffda_experiment does not yet apply expression variables; use the Deno MCP server or omit variables.",
                    }
                });
            }
            let payload = crate::cli::run(
                &[
                    "exec".to_string(),
                    "-e".to_string(),
                    source.to_string(),
                    "--json".to_string(),
                ],
                || Ok(String::new()),
            );
            if payload.exit_code == 0 {
                let value = serde_json::from_str::<Value>(&payload.stdout).unwrap_or(Value::Null);
                json!({
                    "ok": true,
                    "language": language_name,
                    "parse": parse_ok,
                    "runs": [{
                        "index": 0,
                        "input": "",
                        "inputIsJson": false,
                        "ok": true,
                        "value": value,
                    }]
                })
            } else {
                let body = wrap_cli_failure(
                    &payload.stdout,
                    &payload.stderr,
                    "CLI_EXEC_EXECUTION_FAILURE",
                    "execute",
                );
                json!({
                    "ok": false,
                    "language": language_name,
                    "parse": parse_ok,
                    "runs": [{
                        "index": 0,
                        "input": "",
                        "inputIsJson": false,
                        "ok": false,
                        "error": body.get("error").cloned().unwrap_or(body),
                    }]
                })
            }
        }
        Language::Uffda => {
            if sample_list.is_empty() {
                return json!({ "ok": true, "language": language_name, "parse": parse_ok });
            }
            if has_import(&parsed.value) {
                return json!({
                    "ok": false,
                    "language": language_name,
                    "parse": parse_ok,
                    "unsupported": {
                        "code": "MCP_EXPERIMENT_UNSUPPORTED",
                        "phase": "compile",
                        "message": "uffda_experiment cannot run modules that import other files without writing compiled artifacts. Use a self-contained module (no import declarations), or uffda_session_load for project modules.",
                    }
                });
            }
            let mut sessions = super::sessions::SessionManager::new();
            let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let opened = match sessions.open(cwd, None) {
                Ok(session) => session.id.clone(),
                Err(error) => {
                    return json!({
                        "ok": false,
                        "language": language_name,
                        "parse": parse_ok,
                        "unsupported": {
                            "code": "MCP_EXPERIMENT_UNSUPPORTED",
                            "phase": "compile",
                            "message": error.message,
                        }
                    });
                }
            };
            {
                let Ok(session) = sessions.get_mut(&opened) else {
                    return json!({
                        "ok": false,
                        "language": language_name,
                        "parse": parse_ok,
                        "unsupported": {
                            "code": "MCP_EXPERIMENT_UNSUPPORTED",
                            "phase": "compile",
                            "message": "failed to open ephemeral experiment session",
                        }
                    });
                };
                let loaded = session.load(source, None);
                if loaded.get("ok") != Some(&json!(true)) {
                    let _ = sessions.close(&opened);
                    return json!({
                        "ok": false,
                        "language": language_name,
                        "parse": parse_ok,
                        "runs": [{
                            "index": 0,
                            "input": sample_list.first().cloned().unwrap_or_default(),
                            "inputIsJson": input_is_json,
                            "ok": false,
                            "error": loaded.get("error").cloned().unwrap_or(json!({
                                "code": "CLI_EXEC_COMPILATION_FAILURE",
                                "phase": "compile",
                                "message": "module load failed",
                            })),
                        }]
                    });
                }
            }
            let rule = arguments
                .get("rule")
                .and_then(Value::as_str)
                .map(str::to_string);
            let mut runs = Vec::new();
            let mut all_ok = true;
            for (index, sample) in sample_list.iter().enumerate() {
                let Ok(session) = sessions.get_mut(&opened) else {
                    all_ok = false;
                    runs.push(json!({
                        "index": index,
                        "input": sample,
                        "inputIsJson": input_is_json,
                        "ok": false,
                        "error": {
                            "code": "MCP_EXPERIMENT_UNSUPPORTED",
                            "phase": "execute",
                            "message": "ephemeral experiment session closed unexpectedly",
                        }
                    }));
                    break;
                };
                let evaluated = session.eval(
                    None,
                    None,
                    Some(rule.as_deref().unwrap_or("Main")),
                    Some(sample),
                    input_is_json,
                );
                let ok = evaluated.get("ok") == Some(&json!(true));
                if !ok {
                    all_ok = false;
                }
                runs.push(json!({
                    "index": index,
                    "input": sample,
                    "inputIsJson": input_is_json,
                    "ok": ok,
                    "value": evaluated.get("value").cloned(),
                    "error": evaluated.get("error").cloned(),
                }));
            }
            let _ = sessions.close(&opened);
            json!({
                "ok": all_ok,
                "language": language_name,
                "parse": parse_ok,
                "runs": runs,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:mcp-server-014
    fn empty_source_fails_validate() {
        let result = experiment(&json!({ "language": "pattern", "source": "  " }));
        assert_eq!(result["ok"], false);
        assert_eq!(result["parse"]["ok"], false);
    }

    #[test]
    // req:mcp-server-014
    fn module_with_import_is_unsupported_for_run() {
        let result = experiment(&json!({
            "language": "uffda",
            "source": "import \"./other.uff\" Other;\nexport Main;\nrule Main = Other;\n",
            "input": "x",
        }));
        assert_eq!(result["ok"], false);
        assert_eq!(result["parse"]["ok"], true);
        assert_eq!(result["unsupported"]["code"], "MCP_EXPERIMENT_UNSUPPORTED");
    }

    #[test]
    // req:mcp-server-014
    fn pattern_parse_only_does_not_invent_a_match() {
        let result = experiment(&json!({
            "language": "pattern",
            "source": "n:number+",
        }));
        assert_eq!(result["ok"], true);
        assert_eq!(result["parse"]["ok"], true);
        assert!(result.get("runs").is_none());
    }
}

//! Stateless `uffda_experiment` — in-memory parse + match/eval without
//! persistent sessions or artifact writes (`req:mcp-server-014`).
//!
//! Pattern/expression runs reuse the same CLI `-e` paths as `uffda_match` /
//! `uffda_parse` (no artifact writes). Full modules with imports are rejected
//! for the run phase; self-contained modules use an ephemeral in-memory session
//! against the process cwd (no files created for the snippet itself).

use crate::languages::{Language, Languages};
use serde_json::{json, Value};

#[derive(Clone, Debug)]
struct Case {
    name: String,
    input: String,
    input_is_json: bool,
    expect: Option<Value>,
    expect_non_match: bool,
}

fn language_of(name: &str) -> Option<Language> {
    match name {
        "uffda" => Some(Language::Uffda),
        "pattern" => Some(Language::Pattern),
        "expression" => Some(Language::Expression),
        _ => None,
    }
}

fn normalize_cases(arguments: &Value) -> Result<Vec<Case>, Value> {
    let default_json = arguments
        .get("inputIsJson")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if let Some(cases) = arguments.get("cases").and_then(Value::as_array) {
        let mut out = Vec::with_capacity(cases.len());
        for (index, case) in cases.iter().enumerate() {
            let name = case
                .get("name")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("case-{index}"));
            let Some(input) = case.get("input").and_then(Value::as_str) else {
                return Err(json!({
                    "kind": "validate",
                    "code": "MCP_EXPERIMENT_INVALID_CASE",
                    "phase": "validate",
                    "message": format!("case '{name}' requires `input`"),
                    "case": name,
                }));
            };
            let expect_non_match = case
                .get("expectNonMatch")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let has_expect = case.get("expect").is_some();
            if has_expect && expect_non_match {
                return Err(json!({
                    "kind": "validate",
                    "code": "MCP_EXPERIMENT_INVALID_CASE",
                    "phase": "validate",
                    "message": format!("case '{name}' cannot set both expect and expectNonMatch"),
                    "case": name,
                }));
            }
            out.push(Case {
                name,
                input: input.to_string(),
                input_is_json: case
                    .get("inputIsJson")
                    .and_then(Value::as_bool)
                    .unwrap_or(default_json),
                expect: if has_expect {
                    case.get("expect").cloned()
                } else {
                    None
                },
                expect_non_match,
            });
        }
        return Ok(out);
    }

    if let Some(inputs) = arguments.get("inputs").and_then(Value::as_array) {
        return Ok(inputs
            .iter()
            .enumerate()
            .filter_map(|(index, value)| {
                value.as_str().map(|input| Case {
                    name: format!("input-{index}"),
                    input: input.to_string(),
                    input_is_json: default_json,
                    expect: None,
                    expect_non_match: false,
                })
            })
            .collect());
    }

    if let Some(input) = arguments.get("input").and_then(Value::as_str) {
        return Ok(vec![Case {
            name: "input-0".to_string(),
            input: input.to_string(),
            input_is_json: default_json,
            expect: None,
            expect_non_match: false,
        }]);
    }

    Ok(vec![])
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

fn compact(
    ok: bool,
    language: &str,
    total: usize,
    passed: usize,
    failed: usize,
    parse_ok: bool,
    failures: Vec<Value>,
    parse_error: Option<Value>,
    unsupported: Option<Value>,
) -> Value {
    let mut out = json!({
        "ok": ok,
        "language": language,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "parseOk": parse_ok,
        }
    });
    if let Some(error) = parse_error {
        out["parseError"] = error;
    }
    if let Some(value) = unsupported {
        out["unsupported"] = value;
    }
    if !failures.is_empty() {
        out["failures"] = Value::Array(failures);
    }
    out
}

fn wrap_cli_match_success(stdout: &str) -> Value {
    match serde_json::from_str::<Value>(stdout) {
        Ok(value) => {
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

fn into_hint_from_message(message: &str) -> Option<&'static str> {
    let lower = message.to_ascii_lowercase();
    if lower.contains("iterable")
        || lower.contains("e_iterable_expected")
        || (lower.contains("expected value to be a string") && lower.contains("object"))
        || (lower.contains("e_type") && lower.contains("object"))
    {
        return Some(
            "A pipeline stage feeds one scalar item into the next pattern. If the previous stage produced an array or string and the next stage expects characters/items, wrap it in `[Pattern]` (`into`).",
        );
    }
    None
}

fn enrich_match_error(mut error: Value, case_name: &str) -> Value {
    if !error.is_object() {
        error = json!({
            "kind": "match",
            "code": "CLI_MATCH_FAILURE",
            "phase": "match",
            "message": error.to_string(),
        });
    }
    let obj = error.as_object_mut().unwrap();
    obj.entry("kind".to_string())
        .or_insert_with(|| json!("match"));
    obj.insert("case".to_string(), json!(case_name));
    let message = obj
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_string);
    if let Some(message) = message {
        if let Some(hint) = into_hint_from_message(&message) {
            obj.entry("hint".to_string()).or_insert_with(|| json!(hint));
        }
        // Surface a concise actualType when the message encodes a type mismatch.
        if obj.get("actualType").is_none() {
            if let Some(got) = message.split("got ").nth(1) {
                let ty = got.trim().trim_end_matches('.').to_string();
                if !ty.is_empty() && ty.len() < 40 {
                    obj.insert("actualType".to_string(), json!(ty));
                }
            }
        }
    }
    error
}

fn assert_case(case: &Case, matched: bool, value: Option<&Value>) -> Result<(), Value> {
    if case.expect_non_match {
        if !matched {
            return Ok(());
        }
        return Err(json!({
            "name": case.name,
            "ok": false,
            "kind": "assertion",
            "error": {
                "kind": "assertion",
                "code": "MCP_EXPERIMENT_ASSERTION",
                "phase": "match",
                "message": format!("expected non-match for case '{}', but matched", case.name),
                "case": case.name,
                "expectedType": "non-match",
                "actual": value.cloned().unwrap_or(Value::Null),
            }
        }));
    }
    if !matched {
        return Err(json!({
            "name": case.name,
            "ok": false,
            "kind": "match",
            "error": {
                "kind": "match",
                "code": "CLI_MATCH_FAILURE",
                "phase": "match",
                "message": format!("case '{}' did not match", case.name),
                "case": case.name,
            }
        }));
    }
    if let Some(expected) = &case.expect {
        let actual = value.cloned().unwrap_or(Value::Null);
        if &actual != expected {
            return Err(json!({
                "name": case.name,
                "ok": false,
                "kind": "assertion",
                "error": {
                    "kind": "assertion",
                    "code": "MCP_EXPERIMENT_ASSERTION",
                    "phase": "match",
                    "message": format!("assertion failed for case '{}'", case.name),
                    "case": case.name,
                    "expected": expected,
                    "actual": actual,
                }
            }));
        }
    }
    Ok(())
}

fn run_pattern_case(source: &str, case: &Case) -> Result<(), Value> {
    let mut args = vec![
        "match".to_string(),
        "-e".to_string(),
        source.to_string(),
        "--json".to_string(),
    ];
    if case.input_is_json {
        args.push("--input-json".to_string());
    } else {
        args.push("--input".to_string());
    }
    args.push(case.input.clone());
    let payload = crate::cli::run(&args, || Ok(String::new()));
    if payload.exit_code == 0 {
        let body = wrap_cli_match_success(&payload.stdout);
        let value = body.get("value");
        return assert_case(case, true, value);
    }
    let body = wrap_cli_failure(
        &payload.stdout,
        &payload.stderr,
        "CLI_MATCH_FAILURE",
        "match",
    );
    if case.expect_non_match {
        return Ok(());
    }
    let error = enrich_match_error(
        body.get("error").cloned().unwrap_or(body),
        &case.name,
    );
    Err(json!({
        "name": case.name,
        "ok": false,
        "kind": error.get("kind").cloned().unwrap_or(json!("match")),
        "error": error,
    }))
}

fn run_module_case(
    sessions: &mut super::sessions::SessionManager,
    session_id: &str,
    rule: Option<&str>,
    case: &Case,
) -> Result<(), Value> {
    let Ok(session) = sessions.get_mut(session_id) else {
        return Err(json!({
            "name": case.name,
            "ok": false,
            "kind": "unsupported",
            "error": {
                "kind": "unsupported",
                "code": "MCP_EXPERIMENT_UNSUPPORTED",
                "phase": "execute",
                "message": "ephemeral experiment session closed unexpectedly",
                "case": case.name,
            }
        }));
    };
    let evaluated = session.eval(
        None,
        None,
        Some(rule.unwrap_or("Main")),
        Some(&case.input),
        case.input_is_json,
    );
    let matched = evaluated.get("ok") == Some(&json!(true));
    if matched {
        return assert_case(case, true, evaluated.get("value"));
    }
    if case.expect_non_match {
        return Ok(());
    }
    let error = enrich_match_error(
        evaluated.get("error").cloned().unwrap_or(json!({
            "code": "CLI_EXEC_EXECUTION_FAILURE",
            "phase": "execute",
            "message": "module eval failed",
        })),
        &case.name,
    );
    let kind = error
        .get("phase")
        .and_then(Value::as_str)
        .map(|phase| match phase {
            "input" => "input",
            "match" => "match",
            _ => "runtime",
        })
        .unwrap_or("runtime");
    Err(json!({
        "name": case.name,
        "ok": false,
        "kind": kind,
        "error": error,
    }))
}

/// Builds the `uffda_experiment` JSON payload.
pub fn experiment(arguments: &Value) -> Value {
    let language_name = arguments
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("uffda");
    let Some(source) = arguments.get("source").and_then(Value::as_str) else {
        return compact(
            false,
            language_name,
            0,
            0,
            0,
            false,
            vec![],
            Some(json!({
                "kind": "validate",
                "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                "phase": "validate",
                "message": "uffda_experiment requires `source`",
            })),
            None,
        );
    };
    if source.trim().is_empty() {
        return compact(
            false,
            language_name,
            0,
            0,
            0,
            false,
            vec![],
            Some(json!({
                "kind": "validate",
                "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                "phase": "validate",
                "message": "source must be a non-empty Uffda snippet",
            })),
            None,
        );
    }
    let Some(language) = language_of(language_name) else {
        return compact(
            false,
            language_name,
            0,
            0,
            0,
            false,
            vec![],
            Some(json!({
                "kind": "validate",
                "code": "MCP_EXPERIMENT_INVALID_SOURCE",
                "phase": "validate",
                "message": format!("unknown language: {language_name}"),
            })),
            None,
        );
    };

    let cases = match normalize_cases(arguments) {
        Ok(cases) => cases,
        Err(error) => {
            return compact(
                false,
                language_name,
                0,
                0,
                0,
                false,
                vec![],
                Some(error),
                None,
            );
        }
    };

    let mut languages = match Languages::new() {
        Ok(languages) => languages,
        Err(error) => {
            return compact(
                false,
                language_name,
                0,
                0,
                0,
                false,
                vec![],
                Some(json!({
                    "kind": "parse",
                    "code": "CLI_STREAM_PARSE_FAILURE",
                    "phase": "parse",
                    "message": error.to_string(),
                })),
                None,
            );
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
            return compact(
                false,
                language_name,
                cases.len(),
                0,
                0,
                false,
                vec![],
                Some(diagnostics.first().cloned().unwrap_or(json!({
                    "kind": "parse",
                    "code": "CLI_STREAM_PARSE_RECOVERED",
                    "phase": "parse",
                    "message": "parse recovered",
                }))),
                None,
            );
        }
        Err(error) => {
            return compact(
                false,
                language_name,
                cases.len(),
                0,
                0,
                false,
                vec![],
                Some(json!({
                    "kind": "parse",
                    "code": "CLI_STREAM_PARSE_FAILURE",
                    "phase": "parse",
                    "message": error.to_string(),
                })),
                None,
            );
        }
    };

    match language {
        Language::Pattern => {
            if cases.is_empty() {
                return compact(true, language_name, 0, 0, 0, true, vec![], None, None);
            }
            let mut failures = Vec::new();
            let mut passed = 0usize;
            for case in &cases {
                match run_pattern_case(source, case) {
                    Ok(()) => passed += 1,
                    Err(failure) => failures.push(failure),
                }
            }
            let failed = failures.len();
            compact(
                failed == 0,
                language_name,
                cases.len(),
                passed,
                failed,
                true,
                failures,
                None,
                None,
            )
        }
        Language::Expression => {
            if arguments.get("variables").is_some() {
                return compact(
                    false,
                    language_name,
                    0,
                    0,
                    0,
                    true,
                    vec![],
                    None,
                    Some(json!({
                        "kind": "unsupported",
                        "code": "MCP_EXPERIMENT_UNSUPPORTED",
                        "phase": "execute",
                        "message": "uffda_experiment does not yet apply expression variables on this runtime; omit variables or evaluate without bindings.",
                    })),
                );
            }
            if cases.len() > 1 {
                return compact(
                    false,
                    language_name,
                    cases.len(),
                    0,
                    0,
                    true,
                    vec![],
                    None,
                    Some(json!({
                        "kind": "unsupported",
                        "code": "MCP_EXPERIMENT_UNSUPPORTED",
                        "phase": "execute",
                        "message": "language=expression evaluates once; supply at most one case",
                    })),
                );
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
            let case = cases.first().cloned().unwrap_or(Case {
                name: "expression".to_string(),
                input: String::new(),
                input_is_json: false,
                expect: None,
                expect_non_match: false,
            });
            if payload.exit_code == 0 {
                let value = serde_json::from_str::<Value>(&payload.stdout).unwrap_or(Value::Null);
                match assert_case(&case, true, Some(&value)) {
                    Ok(()) => compact(true, language_name, 1, 1, 0, true, vec![], None, None),
                    Err(failure) => {
                        compact(false, language_name, 1, 0, 1, true, vec![failure], None, None)
                    }
                }
            } else {
                let body = wrap_cli_failure(
                    &payload.stdout,
                    &payload.stderr,
                    "CLI_EXEC_EXECUTION_FAILURE",
                    "execute",
                );
                if case.expect_non_match {
                    compact(true, language_name, 1, 1, 0, true, vec![], None, None)
                } else {
                    compact(
                        false,
                        language_name,
                        1,
                        0,
                        1,
                        true,
                        vec![json!({
                            "name": case.name,
                            "ok": false,
                            "kind": "runtime",
                            "error": body.get("error").cloned().unwrap_or(body),
                        })],
                        None,
                        None,
                    )
                }
            }
        }
        Language::Uffda => {
            if cases.is_empty() {
                return compact(true, language_name, 0, 0, 0, true, vec![], None, None);
            }
            if has_import(&parsed.value) {
                return compact(
                    false,
                    language_name,
                    cases.len(),
                    0,
                    0,
                    true,
                    vec![],
                    None,
                    Some(json!({
                        "kind": "unsupported",
                        "code": "MCP_EXPERIMENT_UNSUPPORTED",
                        "phase": "compile",
                        "message": "uffda_experiment cannot run modules that import other files without writing compiled artifacts. Use a self-contained module (no import declarations), or uffda_session_load for project modules.",
                    })),
                );
            }
            let mut sessions = super::sessions::SessionManager::new();
            let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let opened = match sessions.open(cwd, None) {
                Ok(session) => session.id.clone(),
                Err(error) => {
                    return compact(
                        false,
                        language_name,
                        cases.len(),
                        0,
                        0,
                        true,
                        vec![],
                        None,
                        Some(json!({
                            "kind": "unsupported",
                            "code": "MCP_EXPERIMENT_UNSUPPORTED",
                            "phase": "compile",
                            "message": error.message,
                        })),
                    );
                }
            };
            {
                let Ok(session) = sessions.get_mut(&opened) else {
                    return compact(
                        false,
                        language_name,
                        cases.len(),
                        0,
                        0,
                        true,
                        vec![],
                        None,
                        Some(json!({
                            "kind": "unsupported",
                            "code": "MCP_EXPERIMENT_UNSUPPORTED",
                            "phase": "compile",
                            "message": "failed to open ephemeral experiment session",
                        })),
                    );
                };
                let loaded = session.load(source, None);
                if loaded.get("ok") != Some(&json!(true)) {
                    let _ = sessions.close(&opened);
                    return compact(
                        false,
                        language_name,
                        cases.len(),
                        0,
                        1,
                        true,
                        vec![json!({
                            "name": cases.first().map(|c| c.name.as_str()).unwrap_or("input-0"),
                            "ok": false,
                            "kind": "runtime",
                            "error": loaded.get("error").cloned().unwrap_or(json!({
                                "code": "CLI_EXEC_COMPILATION_FAILURE",
                                "phase": "compile",
                                "message": "module load failed",
                            })),
                        })],
                        None,
                        None,
                    );
                }
            }
            let rule = arguments.get("rule").and_then(Value::as_str);
            let mut failures = Vec::new();
            let mut passed = 0usize;
            for case in &cases {
                match run_module_case(&mut sessions, &opened, rule, case) {
                    Ok(()) => passed += 1,
                    Err(failure) => failures.push(failure),
                }
            }
            let _ = sessions.close(&opened);
            let failed = failures.len();
            compact(
                failed == 0,
                language_name,
                cases.len(),
                passed,
                failed,
                true,
                failures,
                None,
                None,
            )
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
        assert_eq!(result["summary"]["parseOk"], false);
        assert!(result.get("parseError").is_some());
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
        assert_eq!(result["summary"]["parseOk"], true);
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
        assert_eq!(result["summary"]["parseOk"], true);
        assert_eq!(result["summary"]["total"], 0);
        assert!(result.get("failures").is_none());
    }

    #[test]
    // req:mcp-server-014
    fn named_cases_assert_expects_and_nonmatches() {
        let result = experiment(&json!({
            "language": "pattern",
            "source": "\"a\"+",
            "cases": [
                { "name": "ok", "input": "aa", "expect": ["a", "a"] },
                { "name": "reject", "input": "x", "expectNonMatch": true },
                { "name": "wrong-expect", "input": "a", "expect": "nope" }
            ]
        }));
        assert_eq!(result["summary"]["parseOk"], true);
        assert_eq!(result["summary"]["passed"], 2);
        assert_eq!(result["summary"]["failed"], 1);
        assert_eq!(result["ok"], false);
        let failures = result["failures"].as_array().unwrap();
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0]["name"], "wrong-expect");
        assert_eq!(failures[0]["error"]["kind"], "assertion");
        assert_eq!(failures[0]["error"]["expected"], "nope");
    }

    #[test]
    // req:mcp-server-014
    fn phone_normalizer_cases_formatting_heuristic() {
        let source = r#"
export Normalize;
rule D = "0".."9";
rule Sep = " " | "-" | "(" | ")" | ".";
rule Normalize =
  any*
  |> [
    plus:("+"?)
    body:(skip Sep | D)*
    end
    -> (join (flat (pack plus body)) "")
  ]
  |> [
    leading:("+"?)
    digits:D*7..15
    end
    -> (join (flat (pack leading digits)) "")
  ];
"#;
        let result = experiment(&json!({
            "language": "uffda",
            "source": source,
            "rule": "Normalize",
            "cases": [
                { "name": "plain", "input": "5551234567", "expect": "5551234567" },
                { "name": "plus", "input": "+1 (555) 123-4567", "expect": "+15551234567" },
                { "name": "dots", "input": "555.123.4567", "expect": "5551234567" },
                { "name": "too-short", "input": "123456", "expectNonMatch": true },
                { "name": "too-long", "input": "1234567890123456", "expectNonMatch": true },
                { "name": "letters", "input": "555-CALL-NOW", "expectNonMatch": true },
                { "name": "mid-plus", "input": "55+51234567", "expectNonMatch": true }
            ]
        }));
        assert_eq!(
            result["summary"]["parseOk"], true,
            "{result}"
        );
        assert!(result.get("unsupported").is_none(), "{result}");
        assert_eq!(result["ok"], true, "{result}");
        assert_eq!(result["summary"]["passed"], 7);
    }

    #[test]
    // req:mcp-server-014
    fn pipeline_scalar_mismatch_surfaces_useful_feedback() {
        let result = experiment(&json!({
            "language": "pattern",
            "source": "any* |> \"0\"..\"9\"+",
            "cases": [{ "name": "scalar-digits", "input": "12" }]
        }));
        assert_eq!(result["ok"], false);
        assert_eq!(result["summary"]["parseOk"], true);
        let failure = &result["failures"][0];
        assert_eq!(failure["error"]["kind"], "match");
        let blob = failure["error"].to_string();
        assert!(
            blob.contains("actualType")
                || blob.contains("hint")
                || blob.contains("expected")
                || blob.contains("message"),
            "{blob}"
        );
    }

    #[test]
    // req:mcp-server-014
    fn into_hint_for_type_object_mismatch() {
        let hint = into_hint_from_message("E_TYPE: expected value to be a string but got object");
        assert!(hint.is_some());
        assert!(hint.unwrap().contains("[Pattern]"));
    }
}

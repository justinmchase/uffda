use std::io::Write;
use std::process::{Command, Output, Stdio};

fn invoke(args: &[&str], input: &str) -> Output {
    invoke_in(args, input, None)
}

#[test]
// req:cli-exec-002 req:runtime-core-012
fn uffda_display_and_strict_interpolation_are_separate() {
    let result = invoke(&["exec", "-e", "[1 2]"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "[1 2]\n");
    let result = invoke(&["exec", "-e", "{ a: [1 2] }"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "{\"a\":[1 2]}\n");
    let roundtrip = invoke(&["exec", "-e", "{ a: [1 2] }", "--json"], "");
    assert!(roundtrip.status.success(), "{}", text(&roundtrip.stderr));
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&roundtrip.stdout).unwrap(),
        serde_json::json!({"a":[1,2]})
    );
    let data = serde_json::json!({"a{b": ["quote\"slash\\\n\t{", -2, true, null]});
    let ast = serde_json::json!({"kind":"value", "value": data}).to_string();
    let rendered = invoke(&["exec", "--ast"], &ast);
    assert!(rendered.status.success(), "{}", text(&rendered.stderr));
    assert_eq!(
        text(&rendered.stdout),
        "{\"a{b\":[\"quote\\\"slash\\\\\\n\\t{\" -2 true null]}\n"
    );
    let roundtrip = invoke(&["exec", "--ast", "--json"], &ast);
    assert!(roundtrip.status.success(), "{}", text(&roundtrip.stderr));
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&roundtrip.stdout).unwrap(),
        data
    );
    for expression in [r#""{[1 2]}""#, r#""{{a:1}}""#, r#""{add}""#, "add", "[add]"] {
        let result = invoke(&["exec", "-e", expression], "");
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stdout.is_empty());
    }
    let result = invoke(&["exec", "-e", "(json [1 2])"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"[1,2]\"\n");
}

fn invoke_in(args: &[&str], input: &str, cwd: Option<&std::path::Path>) -> Output {
    invoke_binary_in(
        std::path::Path::new(env!("CARGO_BIN_EXE_uffda")),
        args,
        input,
        cwd,
    )
}

fn invoke_binary_in(
    binary: &std::path::Path,
    args: &[&str],
    input: &str,
    cwd: Option<&std::path::Path>,
) -> Output {
    let mut command = Command::new(binary);
    command.args(args);
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn Rust CLI");
    let write = child.stdin.take().unwrap().write_all(input.as_bytes());
    if let Err(error) = write
        && error.kind() != std::io::ErrorKind::BrokenPipe
    {
        panic!("write CLI input: {error}");
    }
    child.wait_with_output().expect("wait for Rust CLI")
}

fn text(bytes: &[u8]) -> &str {
    std::str::from_utf8(bytes).expect("UTF-8 process output")
}

struct TestDirectory(std::path::PathBuf);

impl TestDirectory {
    fn outside_workspace() -> Self {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .expect("home for external CLI test directory");
        let path = std::path::PathBuf::from(home).join(format!(
            "uffda-cli-acceptance-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&path).expect("create external CLI test directory");
        Self(path)
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).expect("remove external CLI test directory");
    }
}

#[test]
// req:cli-command-model-001 req:cli-command-model-002
fn process_help_version_and_empty_invocation_have_successful_root_usage() {
    for args in [&[][..], &["--help"][..], &["-h"][..]] {
        let result = invoke(args, "");
        assert_eq!(result.status.code(), Some(0));
        assert!(text(&result.stdout).starts_with("Usage: uffda <command>"));
        assert!(text(&result.stdout).contains("--version, -V"));
        assert!(result.stderr.is_empty());
    }
    for args in [&["--version"][..], &["-V"][..]] {
        let result = invoke(args, "");
        assert_eq!(result.status.code(), Some(0));
        assert_eq!(text(&result.stdout), "0.0.0\n");
        assert!(result.stderr.is_empty());
    }
}

#[test]
// req:cli-language-001
fn parse_eval_alias_selects_pattern_and_expression_languages() {
    for (language, source, expected_kind) in
        [("pattern", "any", "any"), ("expression", "42", "number")]
    {
        let result = invoke(&["parse", "--lang", language, "--eval", source], "");
        assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
        let ast: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(ast["kind"], expected_kind);
        assert!(result.stderr.is_empty());
    }
}

#[test]
// req:cli-command-model-001
fn output_write_failure_uses_internal_failure_exit_code() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_uffda"))
        .args(["exec", "-e", "42"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn Rust CLI");
    drop(child.stdout.take());
    let result = child.wait_with_output().expect("wait for Rust CLI");
    assert_eq!(result.status.code(), Some(70));
    assert!(text(&result.stderr).contains("unable to write output"));
}

#[test]
// req:cli-language-001 req:cli-command-model-001
fn parse_reads_source_from_dash_and_file_path() {
    let directory = TestDirectory::outside_workspace();
    let source = "rule Main = any;";
    let path = directory.0.join("input.uff");
    std::fs::write(&path, source).unwrap();

    let from_stdin = invoke_in(&["parse", "-"], source, Some(&directory.0));
    assert_eq!(
        from_stdin.status.code(),
        Some(0),
        "{}",
        text(&from_stdin.stderr)
    );
    let stdin_ast: serde_json::Value = serde_json::from_slice(&from_stdin.stdout).unwrap();
    assert_eq!(stdin_ast["kind"], "module");

    let from_path = invoke_in(&["parse", path.to_str().unwrap()], "", Some(&directory.0));
    assert_eq!(
        from_path.status.code(),
        Some(0),
        "{}",
        text(&from_path.stderr)
    );
    let path_ast: serde_json::Value = serde_json::from_slice(&from_path.stdout).unwrap();
    assert_eq!(path_ast, stdin_ast);
}

#[test]
// req:cli-command-model-002 req:cli-command-model-001
fn process_mode_conflicts_report_a_usage_diagnostic_and_exit() {
    let result = invoke(&["exec", "--match", "--json"], "");
    assert_eq!(result.status.code(), Some(2));
    assert!(result.stdout.is_empty());
    let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "CLI_USAGE");
    assert_eq!(diagnostic["error"]["phase"], "validation");
    assert!(
        diagnostic["error"]["message"]
            .as_str()
            .unwrap()
            .contains("Conflicting mode selection")
    );

    let result = invoke(&["--mode=parse", "--lang=pattern", "--eval=any"], "");
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    let ast: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(ast["kind"], "any");
    assert!(result.stderr.is_empty());
}

#[test]
// req:cli-command-model-001 req:cli-match-001 req:cli-run-002
fn mode_aliases_accept_inline_option_values() {
    let result = invoke(&["--match", "--eval=any", "--input-json=42", "--json"], "");
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    assert!(result.stderr.is_empty());

    let result = invoke(
        &[
            "--run",
            "--eval=export Main; rule Main = any;",
            "--input-data=42n",
        ],
        "",
    );
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42n\n");
    assert!(result.stderr.is_empty());
}

#[test]
// req:cli-command-model-001 req:cli-run-003
fn relocated_binary_runs_without_project_artifacts_and_reads_run_input_file_as_text() {
    let directory = TestDirectory::outside_workspace();
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .canonicalize()
        .unwrap();
    assert!(!directory.0.canonicalize().unwrap().starts_with(&workspace));

    let binary = std::path::Path::new(env!("CARGO_BIN_EXE_uffda"));
    let artifact_tree = binary.parent().unwrap().canonicalize().unwrap();
    assert!(
        !directory
            .0
            .canonicalize()
            .unwrap()
            .starts_with(&artifact_tree)
            && !artifact_tree.starts_with(&directory.0)
    );
    let relocated_binary = directory
        .0
        .join(format!("uffda{}", std::env::consts::EXE_SUFFIX));
    std::fs::copy(binary, &relocated_binary).expect("copy built CLI outside its artifact tree");
    let subject = directory.0.join("subject.txt");
    std::fs::write(&subject, "hello").unwrap();
    let parsed = invoke(&["parse"], "export Main; rule Main = any;");
    assert_eq!(parsed.status.code(), Some(0), "{}", text(&parsed.stderr));

    let result = invoke_binary_in(
        &relocated_binary,
        &[
            "run",
            "--ast",
            "--entry",
            "Main",
            "--input-file",
            subject.to_str().unwrap(),
            "--json",
        ],
        text(&parsed.stdout),
        Some(&directory.0),
    );
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"h\"\n");
    assert!(result.stderr.is_empty());
    assert!(!directory.0.join("bin").exists());
    assert!(!directory.0.join("uffda.jsonc").exists());
}

#[test]
// req:cli-exec-001
fn expression_stdin_and_inline_outputs() {
    let result = invoke(&["exec", "--ast"], r#"{"kind":"number","value":42}"#);
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    assert!(result.stderr.is_empty());
    let result = invoke(&["exec", "--ast"], r#"{"kind":"value","value":"hello"}"#);
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"hello\"\n");
    let result = invoke(
        &["exec", "--ast", "--json"],
        r#"{"kind":"value","value":"hello"}"#,
    );
    assert_eq!(text(&result.stdout), "\"hello\"\n");
}

#[test]
// req:cli-exec-001 req:expressions-runtime-007
fn expression_output_runs_json_hooks_and_preserves_undefined_contract() {
    let cwd = std::env::temp_dir();
    for (args, expected) in [
        (
            vec!["exec", "-e", "(json { toJSON: <any> -> 42 })"],
            "\"42\"\n",
        ),
        (
            vec![
                "run",
                "-e",
                "export Main; rule Main = end -> { toJSON: <any> -> 42 };",
                "--json",
            ],
            "42\n",
        ),
    ] {
        let result = invoke_in(&args, "", Some(&cwd));
        assert!(result.status.success(), "{}", text(&result.stderr));
        assert_eq!(text(&result.stdout), expected);
    }
    let result = invoke_in(
        &["exec", "-e", "(json { toJSON: <missingRule> -> 42 })"],
        "",
        Some(&cwd),
    );
    assert_eq!(result.status.code(), Some(2));
    assert!(result.stdout.is_empty());
    assert!(text(&result.stderr).contains("missingRule"));
    let expression = r#"{
        "kind":"object","keys":[
            {"kind":"objectKey","name":"toJSON","expression":{
                "kind":"lambda","pattern":{"kind":"any"},"expression":{"kind":"number","value":42}
            }}
        ]
    }"#;
    let result = invoke_in(&["exec", "--ast", "--json"], expression, Some(&cwd));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    let native_hook = r#"{"kind":"object","keys":[
        {"kind":"objectKey","name":"toJSON","expression":{"kind":"reference","name":"not"}}
    ]}"#;
    let result = invoke_in(&["exec", "--ast", "--json"], native_hook, Some(&cwd));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "true\n");
    let failed_hook = r#"{"kind":"object","keys":[
        {"kind":"objectKey","name":"toJSON","expression":{
            "kind":"lambda","pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"missingHookResult"}
        }}
    ]}"#;
    let result = invoke_in(&["exec", "--ast", "--json"], failed_hook, Some(&cwd));
    assert_eq!(result.status.code(), Some(2));
    assert!(result.stdout.is_empty());
    assert!(
        text(&result.stderr).contains("missingHookResult"),
        "{}",
        text(&result.stderr)
    );
    let result = invoke_in(
        &[
            "run",
            "-e",
            "export Main; rule Main = end -> { toJSON: not };",
            "--json",
        ],
        "",
        Some(&cwd),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "true\n");
    let result = invoke_in(
        &["exec", "--ast", "--json"],
        r#"{"kind":"value"}"#,
        Some(&cwd),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "undefined\n");
    let result = invoke_in(&["exec", "--ast"], r#"{"kind":"value"}"#, Some(&cwd));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "undefined\n");
    let pattern = serde_json::json!({
        "kind":"projection","pattern":{"kind":"any"},
        "expression":serde_json::from_str::<serde_json::Value>(native_hook).unwrap()
    })
    .to_string();
    let result = invoke_in(
        &["match", "--ast", "--input", "x", "--json"],
        &pattern,
        Some(&cwd),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "true\n");
    let pattern = serde_json::json!({
        "kind":"projection","pattern":{"kind":"any"},
        "expression":serde_json::from_str::<serde_json::Value>(expression).unwrap()
    })
    .to_string();
    let result = invoke_in(
        &["match", "--ast", "--input", "x", "--json"],
        &pattern,
        Some(&cwd),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
}

#[test]
// req:cli-exec-001 req:cli-command-model-001
fn invalid_input_runtime_and_options_have_usage_exit() {
    for (args, input) in [
        (vec!["exec", "--ast"], "{"),
        (
            vec!["exec", "--ast"],
            r#"{"kind":"reference","name":"missing"}"#,
        ),
        (vec!["exec", "--ast", "--lang", "expression"], ""),
        (vec!["match", "--ast"], r#"{"kind":"any"}"#),
        (
            vec!["exec", "--ast", "/a-file-that-does-not-exist/uffda.json"],
            "",
        ),
    ] {
        let result = invoke(&args, input);
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stdout.is_empty());
        let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
        assert_eq!(diagnostic["ok"], false);
        assert!(diagnostic["error"]["message"].is_string());
    }
    let result = invoke(&["exec", "--ast"], "{");
    let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "CLI_EXEC_INVALID_JSON");
}

#[test]
// req:cli-match-001
fn subjects_use_text_or_scalar_normalization() {
    let result = invoke(&["match", "--ast", "--input", "hello"], r#"{"kind":"any"}"#);
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"h\"\n");
    let result = invoke(
        &["match", "--ast", "--input-json", "[1,2]"],
        r#"{"kind":"any"}"#,
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "[1 2]\n");
    let result = invoke(
        &["match", "--ast", "--input-json", "not-json"],
        r#"{"kind":"any"}"#,
    );
    assert_eq!(result.status.code(), Some(2));
    assert!(result.stdout.is_empty());
    assert!(text(&result.stderr).contains("CLI_MATCH_INVALID_JSON"));
}

#[test]
// req:cli-exec-001 req:cli-match-001
fn actual_expression_and_subject_paths_are_read() {
    let directory = std::env::temp_dir().join(format!(
        "uffda-rust-cli-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&directory).unwrap();
    let expression = directory.join("expression.json");
    let subject = directory.join("subject.txt");
    std::fs::write(&expression, r#"{"kind":"value","value":{"answer":42}}"#).unwrap();
    std::fs::write(&subject, "world").unwrap();
    let result = invoke(&["exec", "--ast", expression.to_str().unwrap()], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "{\"answer\":42}\n");
    let result = invoke(
        &["match", "--ast", "--input-file", subject.to_str().unwrap()],
        r#"{"kind":"any"}"#,
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"w\"\n");
    std::fs::remove_file(expression).unwrap();
    std::fs::remove_file(subject).unwrap();
    std::fs::remove_dir(directory).unwrap();
}

#[test]
// req:cli-exec-001
fn native_calls_and_echo_execute_through_the_binary() {
    let result = invoke(
        &["exec", "--ast"],
        r#"{"kind":"invocation","expression":{"kind":"reference","name":"echo"},"args":[{"kind":"invocation","expression":{"kind":"reference","name":"add"},"args":[{"kind":"number","value":20},{"kind":"number","value":22}]}]}"#,
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
}

#[test]
// req:cli-match-001
fn rightmost_failure_reports_kind_and_position_in_both_modes() {
    let pattern = r#"{"kind":"then","patterns":[{"kind":"any"},{"kind":"equal","value":{"kind":"value.literal","value":"z"}}]}"#;
    let result = invoke(&["match", "--ast", "--input", "ab"], pattern);
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(
        text(&result.stderr),
        "Match failure: Pattern 'equal' did not match input at 1\nInput 1: a value that did not match.\n"
    );
    assert!(result.stdout.is_empty());
    let result = invoke(&["match", "--ast", "--input", "ab", "--json"], pattern);
    assert_eq!(result.status.code(), Some(2));
    let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(diagnostic["error"]["inputPosition"], "1");
    assert_eq!(
        diagnostic["error"]["message"],
        "Pattern 'equal' did not match input at 1"
    );
}

#[test]
// req:cli-exec-001 req:cli-language-001
fn source_expression_exec_and_parse_execute_embedded_grammars() {
    let result = invoke(&["exec", "-e", "(add 20 22)"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    let result = invoke(&["parse", "--lang", "expression", "-e", "42"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    let ast: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(ast["kind"], "number");
    assert_eq!(ast["value"], 42);
}

#[test]
// req:cli-match-001
fn source_pattern_matches_text_and_json_subjects() {
    let result = invoke(&["match", "-e", "\"x\"", "--input", "x"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"x\"\n");
}

#[test]
// req:cli-run-001 req:cli-run-003
fn source_and_syntax_ast_modules_run_the_selected_export() {
    let source = "export Main;\nrule Main = any;";
    let result = invoke(&["run", "--input-json", "42"], source);
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    let parsed = invoke(&["parse"], source);
    assert!(parsed.status.success(), "{}", text(&parsed.stderr));
    let result = invoke(
        &["run", "--ast", "--entry", "Main", "--input", "x"],
        text(&parsed.stdout),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "\"x\"\n");
    let result = invoke(&["run", "-e", "export Main; rule Main = end;"], "");
    assert!(result.status.success(), "{}", text(&result.stderr));
}

#[test]
// req:project-file-001 req:cli-command-model-001
fn explicit_configuration_errors_use_configuration_exit_code() {
    let result = invoke(
        &["exec", "--ast", "--config", "/missing-uffda-project.json"],
        r#"{"kind":"number","value":42}"#,
    );
    assert_eq!(result.status.code(), Some(3));
    let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(diagnostic["error"]["phase"], "configuration");
    assert!(result.stdout.is_empty());
}

#[test]
// req:project-file-001 req:cli-command-model-001
fn explicit_valid_configuration_is_used_for_execution() {
    let directory = TestDirectory::outside_workspace();
    let config = directory.0.join("uffda.jsonc");
    std::fs::write(&config, "{}").unwrap();
    let result = invoke_in(
        &["exec", "--ast", "--config", config.to_str().unwrap()],
        r#"{"kind":"number","value":42}"#,
        Some(&directory.0),
    );
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "42\n");
    assert!(result.stderr.is_empty());
}

#[test]
// req:cli-bootstrap-034 req:project-file-003 req:cli-command-model-001
fn compile_process_uses_project_layout_and_reports_existing_output() {
    let root = std::env::temp_dir().join(format!("uffda-cli-compile-{}", std::process::id()));
    std::fs::create_dir_all(root.join("src")).unwrap();
    std::fs::write(root.join("uffda.jsonc"), r#"{"outDir":"./build"}"#).unwrap();
    std::fs::write(root.join("src/main.uff"), "export Main; rule Main = any;").unwrap();
    let result = invoke_in(&["compile", "src/*.uff"], "", Some(&root));
    assert!(
        result.status.success(),
        "{} {}",
        text(&result.stderr),
        text(&result.stdout)
    );
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["successes"][0]["sourcePath"], "src/main.uff");
    let result = invoke_in(&["compile", "src/main.uff"], "", Some(&root));
    assert_eq!(result.status.code(), Some(2));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["failures"][0]["code"], "CLI_COMPILE_OUTPUT_EXISTS");
    for file in [
        "build/ast/src/main.uffda.ast.json",
        "src/main.uff",
        "uffda.jsonc",
    ] {
        std::fs::remove_file(root.join(file)).unwrap();
    }

    for directory in ["build/ast/src", "build/ast", "build", "src"] {
        std::fs::remove_dir(root.join(directory)).unwrap();
    }
    std::fs::remove_dir(root).unwrap();
}

#[test]
// req:cli-bootstrap-034 req:project-file-003 req:cli-command-model-001
fn source_path_without_command_selects_compile_mode() {
    let directory = TestDirectory::outside_workspace();
    let source_dir = directory.0.join("src");
    std::fs::create_dir(&source_dir).unwrap();
    std::fs::write(source_dir.join("main.uff"), "export Main; rule Main = any;").unwrap();
    let result = invoke_in(&["src/main.uff"], "", Some(&directory.0));
    assert_eq!(result.status.code(), Some(0), "{}", text(&result.stderr));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["successes"][0]["sourcePath"], "src/main.uff");
}

#[test]
// req:cli-fmt-001 req:cli-command-model-001
fn fmt_stdin_check_and_option_contract_runs_through_the_binary() {
    let source = "export Main;rule Main=any;";
    let result = invoke(&["fmt", "-"], source);
    assert!(result.status.success(), "{}", text(&result.stderr));
    let formatted = text(&result.stdout);
    assert!(formatted.contains("rule Main = any;"));
    let result = invoke(&["fmt", "-", "--check", "--json"], source);
    assert_eq!(result.status.code(), Some(2));
    let result: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(result["ok"], false);
    assert_eq!(result["files"][0]["sourcePath"], "<stdin>");
    assert_eq!(result["files"][0]["status"], "changed");
    assert!(result.get("text").is_none());
    let result = invoke(&["fmt", "-", "--check"], formatted);
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(result.stdout.is_empty());
    for args in [
        vec!["fmt", "-", "x.uff"],
        vec!["fmt", "--ast"],
        vec!["fmt", "-e", source],
        vec!["exec", "--check", "-e", "42"],
    ] {
        assert_eq!(invoke(&args, "").status.code(), Some(2));
    }
}

#[test]
// req:cli-fmt-001
fn fmt_globs_skip_unowned_files_check_never_writes_and_normal_format_is_idempotent() {
    let root = std::env::temp_dir().join(format!("uffda-cli-fmt-{}", std::process::id()));
    std::fs::create_dir_all(root.join(".git")).unwrap();
    std::fs::create_dir_all(root.join("node_modules")).unwrap();
    let source = "export Main;rule Main=any;";
    for file in ["main.uff", ".git/ignored.uff", "node_modules/ignored.uff"] {
        std::fs::write(root.join(file), source).unwrap();
    }
    std::fs::write(root.join("unowned.txt"), "not a grammar").unwrap();
    let result = invoke_in(&["fmt", "--check", "--json"], "", Some(&root));
    assert_eq!(result.status.code(), Some(2), "{}", text(&result.stderr));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["files"].as_array().unwrap().len(), 1, "{payload}");
    assert_eq!(payload["files"][0]["sourcePath"], "main.uff");
    assert_eq!(
        std::fs::read_to_string(root.join("main.uff")).unwrap(),
        source
    );
    let result = invoke_in(&["fmt"], "", Some(&root));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert_eq!(text(&result.stdout), "main.uff\n");
    let result = invoke_in(&["fmt", "--check"], "", Some(&root));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(result.stdout.is_empty());
    for file in [".git/ignored.uff", "node_modules/ignored.uff"] {
        assert_eq!(std::fs::read_to_string(root.join(file)).unwrap(), source);
    }
    let result = invoke_in(&["fmt", "unowned.txt", "--json"], "", Some(&root));
    assert_eq!(result.status.code(), Some(2));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(
        payload["files"][0]["diagnostics"][0]["code"],
        "CLI_FMT_NO_LANGUAGE"
    );
    for file in [
        "main.uff",
        ".git/ignored.uff",
        "node_modules/ignored.uff",
        "unowned.txt",
    ] {
        std::fs::remove_file(root.join(file)).unwrap();
    }
    std::fs::remove_dir(root.join(".git")).unwrap();
    std::fs::remove_dir(root.join("node_modules")).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[test]
// req:cli-fmt-001 req:project-file-001
fn fmt_loads_custom_artifact_metadata_and_rejects_duplicate_ownership() {
    let root = std::env::temp_dir().join(format!("uffda-cli-custom-fmt-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("uffda.jsonc"),
        r#"{"languages":["./grammar.uff"]}"#,
    )
    .unwrap();
    let grammar = r#"export Custom;
decorator Language<c:any> = c;
decorator Formatter<f:any> = f;
[Language { id: "custom", extensions: [".foo" ".uff"] }]
[Formatter Render]
rule Custom = any;
rule Render = any -> "canonical";
"#;
    std::fs::write(root.join("grammar.uff"), grammar).unwrap();
    std::fs::write(root.join("duplicate.uff"), grammar).unwrap();
    std::fs::write(root.join("document.foo"), "not canonical").unwrap();
    let result = invoke_in(
        &["compile", "grammar.uff", "duplicate.uff"],
        "",
        Some(&root),
    );
    assert!(
        result.status.success(),
        "{} {}",
        text(&result.stderr),
        text(&result.stdout)
    );
    let result = invoke_in(&["fmt", "document.foo", "--json"], "", Some(&root));
    assert!(
        result.status.success(),
        "{} {}",
        text(&result.stderr),
        text(&result.stdout)
    );
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["files"][0]["language"], "custom");
    assert_eq!(payload["files"][0]["status"], "changed");
    assert_eq!(
        std::fs::read_to_string(root.join("document.foo")).unwrap(),
        "canonical"
    );
    let result = invoke_in(&["fmt", "-"], "export Main;rule Main=any;", Some(&root));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(text(&result.stdout).contains("rule Main = any;"));
    std::fs::write(
        root.join("uffda.jsonc"),
        r#"{"languages":["./grammar.uff","./duplicate.uff"]}"#,
    )
    .unwrap();
    let result = invoke_in(&["fmt", "document.foo"], "", Some(&root));
    assert_eq!(result.status.code(), Some(3), "{}", text(&result.stderr));
    assert!(text(&result.stderr).contains("same id or extension"));
    assert!(result.stdout.is_empty());
    for file in [
        "bin/ast/grammar.uffda.ast.json",
        "bin/ast/duplicate.uffda.ast.json",
        "uffda.jsonc",
        "grammar.uff",
        "duplicate.uff",
        "document.foo",
    ] {
        std::fs::remove_file(root.join(file)).unwrap();
    }
    for directory in ["bin/ast", "bin"] {
        std::fs::remove_dir(root.join(directory)).unwrap();
    }
    std::fs::remove_dir(root).unwrap();
}

#[test]
// req:cli-fmt-001
fn fmt_reports_missing_and_recovered_sources_without_writes_and_accepts_empty_defaults() {
    let root = std::env::temp_dir().join(format!("uffda-cli-fmt-errors-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let result = invoke_in(&["fmt", "--json"], "", Some(&root));
    assert!(result.status.success(), "{}", text(&result.stderr));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(payload["files"], serde_json::json!([]));
    let source = "rule = ;";
    std::fs::write(root.join("bad.uff"), source).unwrap();
    let result = invoke_in(
        &["fmt", "missing.uff", "bad.uff", "--json"],
        "",
        Some(&root),
    );
    assert_eq!(result.status.code(), Some(2));
    let payload: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    let files = payload["files"].as_array().unwrap();
    assert_eq!(files.len(), 2);
    assert!(files.iter().all(|file| file["status"] == "failed"));
    assert_eq!(
        files[0]["diagnostics"][0]["code"],
        "CLI_FMT_SOURCE_NOT_FOUND"
    );
    assert_eq!(
        std::fs::read_to_string(root.join("bad.uff")).unwrap(),
        source
    );
    std::fs::remove_file(root.join("bad.uff")).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[test]
// req:cli-compile-006 req:cli-run-002
fn recovered_parse_emits_ast_and_module_recovery_emits_value_with_reference_diagnostic_shapes() {
    let result = invoke(
        &["parse", "-e", "export Main; rule Main = any", "--json"],
        "",
    );
    assert_eq!(result.status.code(), Some(2));
    let ast: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(ast["kind"], "module");
    assert_eq!(
        ast["declarations"],
        serde_json::json!([{ "kind": "export", "name": "Main" }])
    );
    let payload: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(payload["error"]["code"], "CLI_STREAM_PARSE_RECOVERED");
    assert_eq!(payload["error"]["sourcePath"], "<eval>");
    assert_eq!(payload["error"]["language"], "uffda");
    assert_eq!(
        payload["error"]["location"],
        serde_json::json!({"offset":13,"line":0,"column":13,"endOffset":28})
    );
    let result = invoke(
        &[
            "run",
            "-e",
            "export Main; rule Main = ope \"a\" sneak by any -> 42;",
            "--input",
            "b",
            "--json",
        ],
        "",
    );
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(text(&result.stdout), "42\n");
    let payload: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(payload["error"]["code"], "CLI_EXEC_RECOVERED");
    assert_eq!(
        payload["error"]["span"],
        serde_json::json!({"start":0,"end":1})
    );
    assert!(payload["error"].get("location").is_none());
}

#[test]
// req:cli-run-002 req:cli-match-001
fn standalone_match_recovery_replays_and_keeps_values_spans_and_all_diagnostics() {
    let source = "ope \"a\" sneak by any -> 42";
    let result = invoke(&["match", "-e", source, "--input", "b", "--json"], "");
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(text(&result.stdout), "42\n");
    let payload: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(payload["error"]["code"], "CLI_MATCH_RECOVERED");
    assert_eq!(
        payload["error"]["inputSpan"],
        serde_json::json!({"start":0,"end":1})
    );
    assert_eq!(payload["diagnostics"].as_array().unwrap().len(), 1);
    let result = invoke(&["match", "-e", source, "--input", "b"], "");
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(text(&result.stdout), "42\n");
    assert!(text(&result.stderr).contains("Match recovered at input 0..1"));
    let result = invoke(
        &[
            "match",
            "-e",
            "ope 42 sneak by any",
            "--input-json",
            "7",
            "--json",
        ],
        "",
    );
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(text(&result.stdout), "7\n");
    let payload: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
    assert_eq!(
        payload["error"]["inputSpan"],
        serde_json::json!({"start":0,"end":1})
    );
}

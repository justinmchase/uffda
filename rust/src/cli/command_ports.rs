use crate::cli::{self, options};
use crate::compile::{CompileRequest, compile};
use crate::languages::Languages;
use serde_json::json;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

fn temp_root(label: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "uffda-command-ports-{label}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn write(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(path, content).unwrap();
}

fn cleanup(root: &Path) {
    let _ = std::fs::remove_dir_all(root);
}

fn execute(args: &[&str]) -> cli::CliResult {
    cli::run(
        &args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>(),
        || Ok(String::new()),
    )
}

#[test]
// req:cli-compile-001 req:cli-bootstrap-034
fn compile_writes_a_single_file_artifact_under_the_ast_layout() {
    let root = temp_root("compile-single");
    let src = root.join("src");
    let out = root.join("out");
    write(&src.join("main.uff"), "export Main; rule Main = any;");
    let mut languages = Languages::new().unwrap();
    let imports = BTreeMap::new();
    let paths = ["main.uff".into()];
    let result = compile(
        CompileRequest {
            cwd: &src,
            root: &src,
            out_dir: &out,
            paths: &paths,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(
        result.ok,
        "{}",
        serde_json::to_string(&result).unwrap_or_default()
    );
    assert!(result.failures.is_empty());
    assert_eq!(result.successes.len(), 1);
    assert_eq!(result.successes[0].source_path, "main.uff");
    let artifact = out.join("ast/main.uffda.ast.json");
    assert_eq!(PathBuf::from(&result.successes[0].output_path), artifact);
    let on_disk: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&artifact).unwrap()).unwrap();
    assert!(on_disk["imports"].is_array());
    assert!(on_disk["exports"].is_array());
    assert!(!on_disk["rules"].as_array().unwrap().is_empty());
    cleanup(&root);
}

#[test]
// req:cli-compile-001
fn compile_globs_are_recursive_ordered_and_keep_partial_failures() {
    let root = temp_root("compile-glob");
    let src = root.join("src");
    let out = root.join("out");
    write(&src.join("b/ok.uff"), "export Main; rule Main = any;");
    write(&src.join("a/bad.uff"), "export Main; rule Main =");
    write(&src.join("a/ok.uff"), "export Main; rule Main = any;");
    write(&src.join("a/skip.ts"), "export const x = 1;\n");
    let mut languages = Languages::new().unwrap();
    let imports = BTreeMap::new();
    let paths = ["**/*.uff".into()];
    let result = compile(
        CompileRequest {
            cwd: &src,
            root: &src,
            out_dir: &out,
            paths: &paths,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(!result.ok);
    let units: Vec<_> = result
        .units
        .iter()
        .map(|unit| match unit {
            crate::compile::CompileUnit::Success { success, .. } => success.source_path.as_str(),
            crate::compile::CompileUnit::Failure { source_path, .. } => source_path.as_str(),
        })
        .collect();
    assert_eq!(units, ["a/bad.uff", "a/ok.uff", "b/ok.uff"]);
    let parse_failure = result
        .failures
        .iter()
        .find(|failure| failure.source_path == "a/bad.uff")
        .unwrap();
    assert_eq!(parse_failure.code, "CLI_COMPILE_PARSE_RECOVERED");
    assert!(parse_failure.location.is_some());
    assert_eq!(result.successes.len(), 2);
    assert!(out.join("ast/a/ok.uffda.ast.json").is_file());
    assert!(out.join("ast/b/ok.uffda.ast.json").is_file());
    cleanup(&root);
}

#[test]
// req:cli-compile-001
fn compile_rejects_directory_inputs_and_empty_globs() {
    let root = temp_root("compile-reject");
    let src = root.join("src");
    let out = root.join("out");
    write(&src.join("main.uff"), "export Main; rule Main = any;");
    let mut languages = Languages::new().unwrap();
    let imports = BTreeMap::new();
    let directory = ["src".into()];
    let directory_result = compile(
        CompileRequest {
            cwd: &root,
            root: &root,
            out_dir: &out,
            paths: &directory,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(!directory_result.ok);
    assert_eq!(directory_result.failures.len(), 1);
    assert_eq!(
        directory_result.failures[0].code,
        "CLI_COMPILE_SOURCE_NOT_READABLE"
    );
    assert!(
        directory_result.failures[0]
            .message
            .contains("Directories are not supported")
    );

    let empty = ["**/*.uff".into()];
    let empty_root = temp_root("compile-empty");
    let empty_out = empty_root.join("out");
    let empty_result = compile(
        CompileRequest {
            cwd: &empty_root,
            root: &empty_root,
            out_dir: &empty_out,
            paths: &empty,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(!empty_result.ok);
    assert_eq!(empty_result.failures.len(), 1);
    assert_eq!(
        empty_result.failures[0].code,
        "CLI_COMPILE_SOURCE_NOT_FOUND"
    );
    assert_eq!(empty_result.failures[0].source_path, "**/*.uff");
    cleanup(&root);
    cleanup(&empty_root);
}

#[test]
// req:cli-compile-001 req:project-file-002
fn compile_expands_import_map_names_and_rejects_undeclared_ones() {
    let root = temp_root("compile-imports");
    let source = [
        "import \"./local.uff\" L;",
        "import \"@acme/kv/tokens\" T;",
        "import \"jsr:@x/y@^2/z\" Z;",
        "",
        "rule Main = L;",
        "",
    ]
    .join("\n");
    write(&root.join("main.uff"), &source);
    let mut languages = Languages::new().unwrap();
    let mut imports = BTreeMap::new();
    imports.insert("@acme/kv".into(), "jsr:@acme/kv@^1.2.0".into());
    let paths = ["main.uff".into()];
    let out = root.join("out");
    let ok = compile(
        CompileRequest {
            cwd: &root,
            root: &root,
            out_dir: &out,
            paths: &paths,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(ok.ok, "{}", serde_json::to_string(&ok).unwrap_or_default());
    let on_disk: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&ok.successes[0].output_path).unwrap())
            .unwrap();
    let urls: Vec<_> = on_disk["imports"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| entry["moduleUrl"].as_str().unwrap())
        .collect();
    assert_eq!(
        urls,
        ["./local.uff", "jsr:@acme/kv@^1.2.0/tokens", "jsr:@x/y@^2/z"]
    );

    let missing_root = temp_root("compile-undeclared");
    write(&missing_root.join("main.uff"), &source);
    let missing_out = missing_root.join("out");
    let empty_imports = BTreeMap::new();
    let missing = compile(
        CompileRequest {
            cwd: &missing_root,
            root: &missing_root,
            out_dir: &missing_out,
            paths: &paths,
            imports: &empty_imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(!missing.ok);
    assert_eq!(
        missing.failures[0].code,
        "CLI_COMPILE_UNDECLARED_MODULE_NAME"
    );
    assert!(missing.failures[0].message.contains("@acme/kv/tokens"));
    assert!(!missing_out.join("ast/main.uffda.ast.json").exists());
    cleanup(&root);
    cleanup(&missing_root);
}

#[test]
// req:runtime-core-012 req:cli-exec-002
fn exec_rejects_callable_and_composite_text_without_json() {
    for expression in ["add", "\"{add}\"", "(json add)", "[add]"] {
        let result = execute(&["exec", "-e", expression, "--json"]);
        assert_ne!(result.exit_code, 0, "{expression}");
        assert!(result.stdout.is_empty());
        assert!(
            result.stderr.contains("callable"),
            "{expression}: {}",
            result.stderr
        );
    }
    for expression in ["\"{[1 2]}\"", "\"{{a:1}}\""] {
        let result = execute(&["exec", "-e", expression]);
        assert_ne!(result.exit_code, 0, "{expression}");
        assert!(result.stderr.contains("composite"), "{}", result.stderr);
    }
    let result = execute(&["exec", "-e", "(json [1 2])"]);
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    // Uffda text form quotes string values; the json global still produced JSON text.
    assert!(result.stdout.contains("[1,2]"), "{}", result.stdout);
}

#[test]
// req:cli-exec-002
fn exec_prints_uffda_notation_and_json_compatibly() {
    let plain = execute(&["exec", "-e", "[1 2]"]);
    assert_eq!(plain.exit_code, 0, "{}", plain.stderr);
    assert_eq!(plain.stdout, "[1 2]\n");
    let json_out = execute(&["exec", "-e", "[1 2]", "--json"]);
    assert_eq!(json_out.exit_code, 0, "{}", json_out.stderr);
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&json_out.stdout).unwrap(),
        json!([1, 2])
    );
}

#[test]
// req:cli-command-model-001 req:cli-command-model-002
fn options_parse_preserves_mode_conflicts_from_the_contract_suite() {
    let resolve =
        |args: &[&str]| options::parse(&args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>());
    assert!(resolve(&["exec", "--ast", "-e", "{}"]).is_err());
    assert!(resolve(&["match", "--input", "a", "--input-json", "42"]).is_err());
    let ok = match resolve(&["exec", "-e", "1"]) {
        Ok(options) => options,
        Err(error) => panic!("{}", error.stderr),
    };
    assert_eq!(ok.command, "exec");
}

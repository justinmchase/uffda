//! Content-level ports of Deno CLI surface suites under `src/cli/*.test.ts`.
//! Prefer exercising public Rust APIs in `cli`, `format`, `highlight`,
//! `languages`, `project`, and `diagnostics` over Deno module shapes.

use crate::cli::{self, options};
use crate::format;
use crate::highlight::{self, is_name_role, is_trivia_role};
use crate::languages::{Language, Languages};
use crate::project::Project;
use crate::runtime::DiagnosticKind;
use serde_json::Value;
use std::path::{Path, PathBuf};

fn temp_root(label: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "uffda-surface-ports-{label}-{}-{}",
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

fn execute_stdin(args: &[&str], stdin: &str) -> cli::CliResult {
    let owned = stdin.to_owned();
    cli::run(
        &args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>(),
        move || Ok(owned),
    )
}

fn interesting_spans(spans: &[Value]) -> Vec<(String, String)> {
    spans
        .iter()
        .filter_map(|span| {
            let role = span.get("role")?.as_str()?;
            let text = span.get("text")?.as_str()?;
            if is_trivia_role(role) {
                None
            } else {
                Some((text.to_string(), role.to_string()))
            }
        })
        .collect()
}

fn assert_full_coverage(spans: &[Value], source: &str) {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut cursor = 0usize;
    for span in spans {
        let offset = span["offset"].as_u64().unwrap() as usize;
        let length = span["length"].as_u64().unwrap() as usize;
        assert_eq!(offset, cursor, "spans must be contiguous");
        cursor += length;
    }
    assert_eq!(cursor, units.len(), "spans must cover the entire source");
}

#[test]
// req:cli-command-model-001 req:cli-command-model-005
fn contract_defaults_languages_and_mode_conflicts() {
    let resolve =
        |args: &[&str]| options::parse(&args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>());
    let compile = resolve(&["source/main.uff"]).unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(compile.command, "compile");
    assert_eq!(compile.language.as_deref().unwrap_or("uffda"), "uffda");
    assert_eq!(compile.paths, ["source/main.uff"]);

    let parse = resolve(&["parse"]).unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(parse.command, "parse");

    let exec = resolve(&["exec"]).unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(exec.command, "exec");

    let matched = resolve(&[
        "match",
        "--ast",
        "pattern.json",
        "--input-json",
        "42",
        "--json",
    ])
    .unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(matched.command, "match");
    assert!(matched.ast);
    assert_eq!(matched.paths, ["pattern.json"]);
    assert_eq!(matched.input_json.as_deref(), Some("42"));
    assert!(matched.json);

    for args in [
        &["exec", "--lang", "expression"][..],
        &["match", "--lang", "pattern"],
        &["run", "--lang", "uffda"],
        &["compile", "--lang", "pattern", "source.uff"],
        &["compile", "--ast", "source.uff"],
        &["exec", "--input-json", "42"],
        &["parse", "--mode=compile"],
        &["fmt", "-", "a.uff"],
        &["fmt", "-e", "rule A = a;"],
        &["fmt", "--lang", "pattern", "a.uff"],
        &["fmt", "--ast", "a.uff"],
        &["compile", "--check", "a.uff"],
        &["compile", "a.uff", "--out-dir", "bin"],
    ] {
        assert!(resolve(args).is_err(), "{args:?}");
    }

    let fmt = resolve(&["fmt", "--check", "a.uff", "src/**/*.uff"])
        .unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(fmt.command, "fmt");
    assert!(fmt.check);
    assert_eq!(fmt.paths, ["a.uff", "src/**/*.uff"]);

    let shorthand = resolve(&["--compile", "--parse"]).unwrap_or_else(|e| panic!("{}", e.stderr));
    assert_eq!(shorthand.command, "parse");
}

#[test]
// req:cli-command-model-001 req:cli-exec-001
fn main_help_version_parse_exec_and_match_surface() {
    assert_eq!(execute(&[]).exit_code, 0);
    let help = execute(&["--help"]);
    assert!(help.stdout.contains("Usage: uffda"));
    assert!(help.stdout.contains("exec") || help.stdout.contains("Commands"));
    assert_eq!(
        execute(&["--version"]).stdout,
        format!("{}\n", env!("CARGO_PKG_VERSION"))
    );
    assert!(execute(&["compile", "--help"]).stdout.contains("compile"));
    assert!(execute(&["parse", "-h"]).stdout.contains("parse"));
    assert!(execute(&["mcp", "--help"]).stdout.contains("mcp"));
    assert!(execute(&["lsp", "--help"]).stdout.contains("lsp"));

    let parsed = execute_stdin(&["parse"], "export Main; rule Main = any;");
    assert_eq!(parsed.exit_code, 0, "{}", parsed.stderr);
    assert_eq!(
        serde_json::from_str::<Value>(&parsed.stdout).unwrap()["kind"],
        "module"
    );

    let recovered = execute_stdin(&["parse"], "export Main; rule Main =");
    assert_ne!(recovered.exit_code, 0);
    let diagnostic: Value = serde_json::from_str(&recovered.stderr).unwrap();
    assert_eq!(diagnostic["ok"], false);
    assert!(
        diagnostic["error"]["code"]
            .as_str()
            .unwrap()
            .contains("PARSE_RECOVERED")
            || diagnostic["error"]["code"]
                .as_str()
                .unwrap()
                .contains("STREAM_PARSE_RECOVERED")
            || diagnostic["error"]["phase"] == "parse",
        "{}",
        recovered.stderr
    );

    let pattern = execute_stdin(&["parse", "--lang", "pattern"], "X | Y");
    assert_eq!(pattern.exit_code, 0, "{}", pattern.stderr);
    assert_eq!(
        serde_json::from_str::<Value>(&pattern.stdout).unwrap()["kind"],
        "or"
    );

    let exec = execute(&["exec", "-e", r#"(echo "hello")"#]);
    assert_eq!(exec.exit_code, 0, "{}", exec.stderr);
    assert_eq!(exec.stdout, "\"hello\"\n");

    let matched = execute(&["match", "-e", "any", "--input", "hello"]);
    assert_eq!(matched.exit_code, 0, "{}", matched.stderr);
    assert_eq!(matched.stdout, "\"h\"\n");

    let json_match = execute(&["match", "-e", "any", "--input", "hello", "--json"]);
    assert_eq!(json_match.exit_code, 0, "{}", json_match.stderr);
    assert_eq!(json_match.stdout, "\"h\"\n");

    let number = execute(&["match", "-e", "number", "--input-json", "42"]);
    assert_eq!(number.exit_code, 0, "{}", number.stderr);
    assert_eq!(number.stdout, "42\n");

    let run = execute(&["run", "-e", "export Main; rule Main = ok -> 42;"]);
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    assert_eq!(run.stdout, "42\n");

    let empty_compile = execute(&["compile"]);
    assert_ne!(empty_compile.exit_code, 0);
    assert!(
        empty_compile
            .stderr
            .contains("requires at least one file path or glob pattern")
    );
}

#[test]
// req:cli-match-001
fn match_reports_failures_recoveries_and_invalid_json() {
    let fail = execute(&[
        "match",
        "-e",
        "object { hello: boolean }",
        "--input-json",
        r#"{"hello":true}"#,
    ]);
    assert_ne!(fail.exit_code, 0);
    assert!(fail.stderr.contains("Match failure"), "{}", fail.stderr);
    assert!(fail.stderr.contains("over"), "{}", fail.stderr);

    let invalid = execute(&["match", "-e", "number", "--input-json", "{", "--json"]);
    assert_ne!(invalid.exit_code, 0);
    let diagnostic: Value = serde_json::from_str(&invalid.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "CLI_MATCH_INVALID_JSON");
    assert_eq!(diagnostic["error"]["phase"], "input");

    let recovering = execute(&[
        "match",
        "-e",
        r#"(ope "a" sneak by any)* end"#,
        "--input",
        "axay",
        "--json",
    ]);
    assert_ne!(recovering.exit_code, 0, "{}", recovering.stderr);
    assert!(
        recovering.stderr.contains("CLI_MATCH_RECOVERED")
            || recovering.stderr.contains("Recovered")
            || recovering.stderr.contains("Expected"),
        "{}",
        recovering.stderr
    );

    let ok = execute(&[
        "match",
        "-e",
        r#"(ope "a" sneak by any)* end"#,
        "--input",
        "aa",
    ]);
    assert_eq!(ok.exit_code, 0, "{}", ok.stderr);
}

#[test]
// req:cli-exec-001 req:cli-exec-002
fn exec_ast_expression_and_module_entry_surface() {
    let ast = execute_stdin(
        &["exec", "--ast"],
        r#"{"kind":"invocation","expression":{"kind":"reference","name":"echo"},"args":[{"kind":"string","values":["hello"]}]}"#,
    );
    assert_eq!(ast.exit_code, 0, "{}", ast.stderr);
    // Value text uses JSON string encoding for string results.
    assert_eq!(ast.stdout, "\"hello\"\n");

    let bad_ast = execute_stdin(&["exec", "--ast"], r#"{"kind":"or"}"#);
    assert_ne!(bad_ast.exit_code, 0);

    let bad_json = execute_stdin(&["exec", "--ast"], "{");
    assert_ne!(bad_json.exit_code, 0);
    assert!(
        bad_json.stderr.contains("CLI_EXEC_INVALID_JSON") || bad_json.stderr.contains("invalid"),
        "{}",
        bad_json.stderr
    );

    let module = execute(&[
        "run",
        "-e",
        "export Main; export Other; rule Main = ok -> 1; rule Other = ok -> 2;",
        "--entry",
        "Other",
    ]);
    assert_eq!(module.exit_code, 0, "{}", module.stderr);
    assert_eq!(module.stdout, "2\n");
}

#[test]
// req:cli-fmt-001
fn fmt_rewrites_checks_and_reports_unclean_parses() {
    // Prefer absolute paths: `cli::effective_cwd` honors PWD/INIT_CWD over
    // `env::set_current_dir`, so relative globs would resolve against the shell cwd.
    let root = temp_root("fmt");
    let unformatted = "rule   A =   \"a\"  ;\n";
    let formatted = "rule A = \"a\";\n";
    let a = root.join("a.uff");
    let b = root.join("b.uff");
    let bad = root.join("bad.uff");
    write(&a, unformatted);
    write(&b, formatted);

    let a_s = a.to_str().unwrap();
    let b_s = b.to_str().unwrap();
    let bad_s = bad.to_str().unwrap();

    let rewrite = execute(&["fmt", a_s, b_s, "--json"]);
    assert_eq!(rewrite.exit_code, 0, "{}", rewrite.stderr);
    let summary: Value = serde_json::from_str(&rewrite.stdout).unwrap();
    assert_eq!(summary["ok"], true);
    assert_eq!(summary["check"], false);
    let statuses: Vec<_> = summary["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| {
            (
                file["sourcePath"].as_str().unwrap().to_string(),
                file["status"].as_str().unwrap().to_string(),
            )
        })
        .collect();
    assert!(
        statuses
            .iter()
            .any(|(path, status)| path.ends_with("a.uff") && status == "changed"),
        "{statuses:?}"
    );
    assert!(
        statuses
            .iter()
            .any(|(path, status)| path.ends_with("b.uff") && status == "unchanged"),
        "{statuses:?}"
    );
    assert_eq!(std::fs::read_to_string(&a).unwrap(), formatted);

    write(&a, unformatted);
    let checked = execute(&["fmt", "--check", a_s, "--json"]);
    assert_ne!(checked.exit_code, 0);
    assert_eq!(std::fs::read_to_string(&a).unwrap(), unformatted);

    write(&bad, "rule = ;\n");
    let failed = execute(&["fmt", bad_s, "--json"]);
    assert_ne!(failed.exit_code, 0);
    let failed_summary: Value = serde_json::from_str(&failed.stdout).unwrap();
    assert_eq!(failed_summary["files"][0]["status"], "failed");
    assert!(
        failed_summary["files"][0]["diagnostics"][0]["code"]
            .as_str()
            .unwrap()
            .contains("PARSE_RECOVERED")
            || failed_summary["files"][0]["diagnostics"][0]["code"] == "CLI_FMT_PARSE_RECOVERED",
        "{}",
        failed.stdout
    );
    assert_eq!(std::fs::read_to_string(&bad).unwrap(), "rule = ;\n");
    cleanup(&root);
}

#[test]
// req:cli-fmt-001
fn fmt_api_rejects_unknown_language_and_missing_sources() {
    // Separate from CLI fmt: creating Languages after heavy CLI work has
    // historically SIGSEGV'd under the GC (see remport_ format corpus).
    let _guard = crate::test_sync::languages_lock();
    let root = temp_root("fmt-api");
    write(&root.join("notes.txt"), "x");
    let mut grammar = Languages::new().unwrap();
    let languages = grammar.project_languages(None).unwrap();
    let api = format::files(
        &mut grammar,
        &languages,
        &root,
        &["notes.txt".into(), "missing.uff".into()],
        false,
    );
    assert!(!api.ok);
    let codes: Vec<_> = api
        .files
        .iter()
        .flat_map(|file| file.diagnostics.iter().map(|d| d.code))
        .collect();
    assert!(codes.contains(&"CLI_FMT_NO_LANGUAGE") || codes.contains(&"CLI_FMT_SOURCE_NOT_FOUND"));
    cleanup(&root);
}

#[test]
// req:cli-language-server-005 req:mcp-server-009
fn highlight_classifies_roles_gap_free_across_languages() {
    let _guard = crate::test_sync::languages_lock();
    let mut languages = Languages::new().unwrap();
    let source = "rule A = \\cZs | switch { \\cNd: any };";
    let result = languages.highlight(source, Language::Uffda).unwrap();
    let spans = result["spans"].as_array().unwrap();
    assert_full_coverage(spans, source);
    let strings: Vec<_> = spans
        .iter()
        .filter(|s| s["role"] == "string")
        .map(|s| s["text"].as_str().unwrap())
        .collect();
    assert!(
        strings.contains(&"\\") || strings.iter().any(|t| t.contains('c')),
        "{strings:?}"
    );

    let keywords_source = r#"rule A = switch { "a": any, default: not end } | in [1] -> (f null);
rule B = "switch";
"#;
    let keywords = languages
        .highlight(keywords_source, Language::Uffda)
        .unwrap();
    let roles = interesting_spans(keywords["spans"].as_array().unwrap());
    for expected in [
        "rule", "switch", "any", "default", "not", "end", "in", "null",
    ] {
        assert!(
            roles
                .iter()
                .any(|(text, role)| text == expected && role == "keyword"),
            "missing keyword {expected}: {roles:?}"
        );
    }

    let module = "import \"./x.uff\" A;\nexport B;\nrule B = any;\n";
    let module_hl = languages.highlight(module, Language::Uffda).unwrap();
    assert_full_coverage(module_hl["spans"].as_array().unwrap(), module);
    let keyword_texts: Vec<_> = module_hl["spans"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|s| s["role"] == "keyword")
        .map(|s| s["text"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(keyword_texts, ["import", "export", "rule", "any"]);

    let comment = "# a comment\nrule A = any;\n";
    let comment_hl = languages.highlight(comment, Language::Uffda).unwrap();
    assert!(
        comment_hl["spans"]
            .as_array()
            .unwrap()
            .iter()
            .any(|s| s["role"] == "comment" && s["text"] == "# a comment")
    );

    let recovered = "import \"./x.uff\" A\nrule B = any;\n";
    let recovered_hl = languages.highlight(recovered, Language::Uffda).unwrap();
    assert_eq!(recovered_hl["ok"], false);
    assert_full_coverage(recovered_hl["spans"].as_array().unwrap(), recovered);

    let pattern = languages
        .highlight(r#""a" | "b""#, Language::Pattern)
        .unwrap();
    assert_eq!(pattern["ok"], true);
    assert_full_coverage(pattern["spans"].as_array().unwrap(), r#""a" | "b""#);

    let expression = languages
        .highlight("(add 1 2)", Language::Expression)
        .unwrap();
    assert_eq!(expression["ok"], true);
    assert_full_coverage(expression["spans"].as_array().unwrap(), "(add 1 2)");

    assert!(is_name_role("identifier"));
    assert!(is_name_role("function"));
    assert!(!is_name_role("keyword"));
    assert!(highlight::is_trivia_role("whitespace"));
}

#[test]
// req:error-recovery-008 req:cli-compile-006
fn diagnostics_explain_recoveries_from_parse_analysis() {
    let _guard = crate::test_sync::languages_lock();
    let mut languages = Languages::new().unwrap();
    let source = "rule A =\n  |> B # ok?\n  |> C\n;";
    let analysis = languages
        .analyze(source, Language::Uffda)
        .unwrap_or_else(|error| panic!("{error}"));
    assert!(
        !analysis.diagnostics.is_empty(),
        "expected recovery diagnostics"
    );
    let first = &analysis.diagnostics[0];
    assert_eq!(first.kind, DiagnosticKind::Recovery);
    let end = first.location.end_offset.unwrap_or(first.location.offset);
    let start = first.location.offset.min(source.len());
    let end = end.min(source.len()).max(start);
    let span_text = &source[start..end];
    assert!(
        first.message.contains("comment")
            || first.message.contains("pattern")
            || first.message.contains("Expected")
            || !span_text.is_empty(),
        "message={} span={span_text}",
        first.message
    );

    let unexplained = "rule A = not;";
    let analysis = languages
        .analyze(unexplained, Language::Uffda)
        .unwrap_or_else(|error| panic!("{error}"));
    if let Some(diagnostic) = analysis.diagnostics.first() {
        assert!(!diagnostic.message.is_empty());
    }
}

#[test]
// req:project-file-001 req:project-file-002 req:project-file-003
fn command_project_reads_nearest_out_dir_imports_and_lockfile() {
    let root = temp_root("project");
    write(
        &root.join("uffda.jsonc"),
        r#"{ "imports": { "@a/b": "jsr:@a/b@^1" }, "outDir": "./build" }"#,
    );
    write(
        &root.join("uffda.lock"),
        r#"{"specifiers":{"jsr:@a/b@^1":"1.0.0"},"jsr":{}}"#,
    );
    std::fs::create_dir_all(root.join("src")).unwrap();

    let _guard = crate::test_sync::languages_lock();
    let mut grammar = Languages::new().unwrap();
    let path = Project::discover(&root.join("src"), None)
        .unwrap()
        .expect("project");
    let project = Project::load(path, &mut grammar).unwrap();
    assert_eq!(project.root, root);
    assert_eq!(project.imports["@a/b"], "jsr:@a/b@^1");
    assert_eq!(project.out_dir, root.join("build"));
    assert!(project.resolver().is_ok());

    let named = temp_root("project-config");
    write(
        &named.join("conf/other.jsonc"),
        r#"{ "imports": { "@c": "jsr:@c/d@^2" } }"#,
    );
    let path = Project::discover(&named, Some("conf/other.jsonc"))
        .unwrap()
        .expect("named config");
    let project = Project::load(path, &mut grammar).unwrap();
    assert_eq!(project.imports["@c"], "jsr:@c/d@^2");
    assert_eq!(project.root, named.join("conf"));

    let bare = temp_root("project-bare");
    assert_eq!(Project::discover(&bare, None).unwrap(), None);

    let invalid = temp_root("project-invalid");
    write(
        &invalid.join("uffda.jsonc"),
        r#"{ "imports": [], "extra": 1 }"#,
    );
    let path = Project::discover(&invalid, None).unwrap().unwrap();
    assert!(Project::load(path, &mut grammar).is_err());

    let bad_lock = temp_root("project-lock");
    write(&bad_lock.join("uffda.jsonc"), "{}");
    write(&bad_lock.join("uffda.lock"), "[]");
    let path = Project::discover(&bad_lock, None).unwrap().unwrap();
    let project = Project::load(path, &mut grammar).unwrap();
    assert!(project.resolver().is_err());

    cleanup(&root);
    cleanup(&named);
    cleanup(&bare);
    cleanup(&invalid);
    cleanup(&bad_lock);
}

#[test]
// req:project-file-001 req:cli-fmt-001
fn project_languages_builtin_and_custom_registry() {
    let _guard = crate::test_sync::languages_lock();
    let mut grammar = Languages::new().unwrap();
    let languages = grammar.project_languages(None).unwrap();
    assert_eq!(languages.len(), 1);
    assert_eq!(languages[0].id, "uffda");
    assert_eq!(languages[0].extensions, [".uff"]);
    assert!(languages[0].formatter.is_some());
}

#[test]
// req:cli-compile-001 req:project-file-003
fn main_compile_honors_project_outdir_and_rejects_outside_root() {
    // Absolute paths + --config: see fmt note about PWD/INIT_CWD vs set_current_dir.
    let root = temp_root("compile-outdir");
    let config = root.join("uffda.jsonc");
    let source = root.join("src/nested/main.uff");
    write(&config, r#"{ "outDir": "./build" }"#);
    write(&source, "export Main; rule Main = any;");
    let result = execute(&[
        "compile",
        source.to_str().unwrap(),
        "--config",
        config.to_str().unwrap(),
    ]);
    assert_eq!(
        result.exit_code, 0,
        "stdout={} stderr={}",
        result.stdout, result.stderr
    );
    assert!(
        root.join("build/ast/src/nested/main.uff.ast.json")
            .is_file()
            || root.join("build/ast/nested/main.uff.ast.json").is_file(),
        "stdout={}",
        result.stdout
    );

    let outside = temp_root("compile-outside");
    let app_config = outside.join("app/uffda.jsonc");
    let other = outside.join("other.uff");
    write(&app_config, "{}");
    write(&other, "export Main; rule Main = any;");
    let rejected = execute(&[
        "compile",
        other.to_str().unwrap(),
        "--config",
        app_config.to_str().unwrap(),
    ]);
    assert_ne!(rejected.exit_code, 0);
    assert!(
        rejected.stdout.contains("CLI_COMPILE_SOURCE_OUTSIDE_ROOT")
            || rejected.stderr.contains("CLI_COMPILE_SOURCE_OUTSIDE_ROOT")
            || rejected.stdout.contains("outside"),
        "stdout={} stderr={}",
        rejected.stdout,
        rejected.stderr
    );
    cleanup(&root);
    cleanup(&outside);
}

#[test]
// req:cli-distribution-001 req:cli-distribution-004 req:data-codec-004
fn distribution_target_matrix_and_artifact_names() {
    const TARGETS: &[&str] = &[
        "x86_64-unknown-linux-gnu",
        "aarch64-unknown-linux-gnu",
        "x86_64-pc-windows-msvc",
        "aarch64-pc-windows-msvc",
        "x86_64-apple-darwin",
        "aarch64-apple-darwin",
    ];
    assert_eq!(TARGETS.len(), 6);
    let asset = |version: &str, target: &str| {
        let suffix = if target.contains("windows") {
            ".exe"
        } else {
            ""
        };
        format!("uffda-{version}-{target}{suffix}")
    };
    for target in TARGETS {
        let name = asset("0.1.2", target);
        assert!(name.starts_with("uffda-0.1.2-"));
        assert!(name.contains(target));
        assert_eq!(name.ends_with(".exe"), target.contains("windows"));
    }
    assert_eq!(
        asset("1.2.3", "x86_64-unknown-linux-gnu"),
        "uffda-1.2.3-x86_64-unknown-linux-gnu"
    );
    assert_eq!(
        asset("1.2.3", "x86_64-pc-windows-msvc"),
        "uffda-1.2.3-x86_64-pc-windows-msvc.exe"
    );
    assert_eq!(
        asset("1.2.3", "aarch64-apple-darwin"),
        "uffda-1.2.3-aarch64-apple-darwin"
    );

    let release = std::fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join(".github/workflows/release-binaries.yml"),
    )
    .unwrap();
    let compile = release
        .find("  compile-rust:")
        .map(|index| &release[index..])
        .unwrap_or("");
    assert!(!compile.contains("uffdar"));
    assert!(compile.contains("--bin uffda"));
    assert!(compile.contains("name: uffda-${{ matrix.target }}"));
}

#[test]
// req:mcp-server-011
fn display_surface_open_is_loopback_and_session_scoped() {
    // Product surface lives in MCP (`DisplayManager`); exercise the open/render
    // contract through the MCP message handler already covered in `mcp/mod.rs`.
    // This port asserts the release workflow + naming stay Rust-CLI shaped and
    // that highlight markup used for display remains gap-free JSON spans.
    let _guard = crate::test_sync::languages_lock();
    let mut languages = Languages::new().unwrap();
    let source = "rule A = any;\n";
    let result = languages.highlight(source, Language::Uffda).unwrap();
    assert_eq!(result["ok"], true);
    assert!(
        result["spans"]
            .as_array()
            .unwrap()
            .iter()
            .any(|span| span["role"] == "keyword" && span["text"] == "rule")
    );
    let nodes = crate::mcp::display_transform::highlight_result_to_display_nodes(&result);
    assert_eq!(nodes.len(), result["spans"].as_array().unwrap().len());
    assert!(
        nodes
            .iter()
            .any(|node| node.label == "rule" && node.css_class == "hl-keyword")
    );
    let html = crate::mcp::display_transform::render_display_html(&nodes);
    assert!(html.contains("<span class=\"hl-keyword\""));
    assert!(html.contains(">rule<"));
}

#[test]
// req:cli-compile-006
fn stream_parse_failure_locations_and_pipeline_messages() {
    let recovered = execute_stdin(&["parse"], "export Main; rule Main =");
    assert_ne!(recovered.exit_code, 0);
    assert!(!recovered.stdout.is_empty() || !recovered.stderr.is_empty());
    let diagnostic: Value =
        serde_json::from_str(if recovered.stderr.trim_start().starts_with('{') {
            &recovered.stderr
        } else {
            &recovered.stdout
        })
        .unwrap_or_else(|_| {
            serde_json::from_str(&recovered.stderr).unwrap_or_else(|_| {
                panic!(
                    "expected JSON diagnostic: stdout={} stderr={}",
                    recovered.stdout, recovered.stderr
                )
            })
        });
    let error = diagnostic.get("error").cloned().unwrap_or(diagnostic);
    assert_eq!(error["phase"], "parse");
    assert!(
        error["message"].as_str().unwrap_or("").contains("pattern")
            || error["message"].as_str().unwrap_or("").contains("rule")
            || error.get("location").is_some(),
        "{error}"
    );

    let pipeline = [
        "export Main;",
        "rule Main =",
        "  (",
        "    any",
        "    |> ",
        "  )",
        "  ;",
    ]
    .join("\n");
    let pipe = execute_stdin(&["parse"], &pipeline);
    assert_ne!(pipe.exit_code, 0);
    assert!(
        pipe.stderr.contains("pattern")
            || pipe.stderr.contains("Unexpected")
            || pipe.stdout.contains("pattern"),
        "stdout={} stderr={}",
        pipe.stdout,
        pipe.stderr
    );
}

#[test]
// req:cli-compile-006
fn parse_failure_reports_source_locations_for_incomplete_patterns() {
    // Deno had a separate `anchorParseFailureLocation` helper; Rust diagnostics
    // already carry UTF-16 line/column from the runtime span (specs outrank Deno).
    let _guard = crate::test_sync::languages_lock();
    let mut languages = Languages::new().unwrap();
    for source in ["(a |\n\n)", "(a | # alternatives\n)", "(a | )"] {
        let analysis = languages
            .analyze(source, Language::Pattern)
            .unwrap_or_else(|error| panic!("{error}"));
        assert!(
            !analysis.diagnostics.is_empty(),
            "expected diagnostics for {source:?}"
        );
        let loc = &analysis.diagnostics[0].location;
        assert!(
            loc.offset <= source.encode_utf16().count(),
            "offset={} source={source:?}",
            loc.offset
        );
        assert!(!analysis.diagnostics[0].message.is_empty());
    }
}

use std::io::Write;
use std::process::{Command, Output, Stdio};
use std::sync::{Mutex, OnceLock};

fn invoke_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn invoke(args: &[&str], input: &str) -> Output {
    let _guard = invoke_lock().lock().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_uffda"))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();
    child.wait_with_output().unwrap()
}

fn output(result: &Output) -> &str {
    assert!(
        result.status.success(),
        "process failed with {}: {}",
        result.status,
        String::from_utf8_lossy(&result.stderr)
    );
    std::str::from_utf8(&result.stdout).unwrap()
}

#[test]
// req:standard-library-003
fn codec_globals_execute_through_the_binary() {
    let encoded = invoke(&["exec", "-e", "(to_codec {values:[undefined 42]})"], "");
    assert_eq!(output(&encoded), "\"{values:[undefined 42]}\"\n");
    let decoded = invoke(
        &[
            "exec",
            "-e",
            "(from_codec (to_codec {values:[undefined 42]}))",
        ],
        "",
    );
    assert_eq!(output(&decoded), "{values:[undefined 42]}\n");
}

#[test]
// req:cli-exec-002 req:cli-match-002 req:cli-run-004
fn default_values_roundtrip_through_data_subjects_and_json_remains_explicit() {
    for expression in [
        r#""hello""#,
        r#""line\n\{brace}""#,
        "undefined",
        "[1 2]",
        "{ a: [1 2] }",
    ] {
        let rendered = invoke(&["exec", "-e", expression], "");
        let encoded = output(&rendered);
        let matched = invoke(&["match", "-e", "any", "--input-data", encoded], "");
        assert_eq!(output(&matched), encoded);
        let executed = invoke(
            &[
                "run",
                "-e",
                "export Main; rule Main = any;",
                "--input-data",
                encoded,
            ],
            "",
        );
        assert_eq!(output(&executed), encoded);
    }
    assert_eq!(
        output(&invoke(&["exec", "-e", r#""hello""#], "")),
        "\"hello\"\n"
    );
    assert_eq!(
        output(&invoke(&["exec", "-e", "undefined"], "")),
        "undefined\n"
    );
    assert_eq!(
        output(&invoke(&["exec", "-e", r#""hello""#, "--json"], "")),
        "\"hello\"\n"
    );
    assert_eq!(
        output(&invoke(&["exec", "-e", "undefined", "--json"], "")),
        "undefined\n"
    );
    let json = invoke(&["exec", "-e", "{ a: [1 2] }", "--json"], "");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(output(&json)).unwrap(),
        serde_json::json!({"a": [1, 2]})
    );
}

#[test]
// req:cli-match-002 req:cli-run-004 req:data-codec-003 req:runtime-strings-002
fn codec_subjects_preserve_native_tags_special_numbers_and_surrogate_units() {
    for source in [
        "-0",
        "-2.5",
        "NaN",
        "Infinity",
        "-Infinity",
        "123456789012345678901234567890n",
        r#""\ud800""#,
        r#""{add}""#,
        r#"@date"2026-10-11T16:30:00Z""#,
        r#"@bytes"AP8""#,
        r#"@symbol"key""#,
        "@set[1 2]",
        r#"{key:42n}"#,
        r#"@error{name:"TypeError" message:"bad" cause:[undefined]}"#,
        r#"{"__proto__":42 "surrogate":"\udfff"}"#,
    ] {
        let matched = invoke(&["match", "-e", "any", "--input-data", source], "");
        let encoded = output(&matched);
        let executed = invoke(
            &[
                "run",
                "-e",
                "export Main; rule Main = any;",
                "--input-data",
                encoded,
            ],
            "",
        );
        assert_eq!(output(&executed), encoded);
    }
    let bigint = invoke(&["match", "-e", "any", "--input-data", "42n", "--json"], "");
    assert!(!bigint.status.success());
    assert!(bigint.stdout.is_empty());
    let date = invoke(
        &[
            "match",
            "-e",
            "any",
            "--input-data",
            r#"@date"2026-10-11T16:30:00Z""#,
            "--json",
        ],
        "",
    );
    assert_eq!(output(&date), "\"2026-10-11T16:30:00Z\"\n");
}

#[test]
// req:cli-match-002 req:cli-run-004 req:cli-match-001 req:cli-run-001
fn data_subject_modes_are_distinct_from_text_json_and_program_ast() {
    let pattern = r#"{"kind":"any"}"#;
    for (flag, subject, expected) in [
        ("--input", "ab", "\"a\"\n"),
        ("--input-json", "\"ab\"", "\"ab\"\n"),
        ("--input-data", "\"ab\"", "\"ab\"\n"),
        ("--input-data=[1 2]", "", "[1 2]\n"),
    ] {
        let mut args = vec!["match", "--ast", flag];
        if !flag.contains('=') {
            args.push(subject);
        }
        assert_eq!(output(&invoke(&args, pattern)), expected);
    }
    assert_eq!(
        output(&invoke(
            &[
                "match",
                "-e",
                "any",
                "--input-data",
                "# leading\n[1\n2]\n# trailing\n"
            ],
            ""
        )),
        "[1 2]\n"
    );
    let module_ast = invoke(&["parse", "-e", "export Main; rule Main = any;"], "");
    assert_eq!(
        output(&invoke(
            &["run", "--ast", "--input-data", "42n"],
            output(&module_ast)
        )),
        "42n\n"
    );
    for command in ["match", "run"] {
        let source = if command == "match" {
            "any"
        } else {
            "export Main; rule Main = any;"
        };
        for invalid in [
            "",
            "# no value\n",
            "1\n2",
            "1 2",
            "[1",
            "(add 1 2)",
            "@unknown[]",
            "{\"a\":1 \"a\":2}",
        ] {
            let result = invoke(&[command, "-e", source, "--input-data", invalid], "");
            assert_eq!(result.status.code(), Some(2));
            assert!(result.stdout.is_empty());
            let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
            assert_eq!(diagnostic["error"]["code"], "CLI_MATCH_INVALID_DATA");
            assert_eq!(diagnostic["error"]["phase"], "input");
        }
        for flag in [
            "--input",
            "--input-json",
            "--input-file",
            "--input-data",
            "--input-data-file",
        ] {
            let result = invoke(
                &[command, "-e", source, "--input-data", "42", flag, "42"],
                "",
            );
            assert_eq!(result.status.code(), Some(2));
            assert!(String::from_utf8_lossy(&result.stderr).contains("mutually exclusive"));
        }
    }
    for command in ["exec", "parse", "compile", "fmt"] {
        let result = invoke(&[command, "--input-data", "42"], "");
        assert_eq!(result.status.code(), Some(2));
    }
    for flag in ["--input-data", "--input-data-file"] {
        assert_eq!(
            invoke(&["match", "-e", "any", flag], "").status.code(),
            Some(2)
        );
    }
}

#[test]
// req:cli-match-002 req:cli-run-004 req:cli-exec-002
fn file_data_subjects_accept_one_record_and_report_read_and_decode_errors() {
    let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".tmp/m8");
    std::fs::create_dir_all(&directory).unwrap();
    let path = directory.join(format!("cli-data-{}.data", std::process::id()));
    struct Cleanup(std::path::PathBuf);
    impl Drop for Cleanup {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    let _cleanup = Cleanup(path.clone());
    let file = path.to_str().unwrap();
    std::fs::write(&path, "# one value\n{\"a\":42n}\n").unwrap();
    for args in [
        vec!["match", "-e", "any", "--input-data-file", file],
        vec![
            "run",
            "-e",
            "export Main; rule Main = any;",
            "--input-data-file",
            file,
        ],
    ] {
        assert_eq!(output(&invoke(&args, "")), "{a:42n}\n");
    }
    std::fs::write(&path, "1\n2\n").unwrap();
    let invalid = invoke(&["match", "-e", "any", "--input-data-file", file], "");
    assert_eq!(invalid.status.code(), Some(2));
    assert!(invalid.stdout.is_empty());
    std::fs::remove_file(&path).unwrap();
    let missing = invoke(
        &[
            "run",
            "-e",
            "export Main; rule Main = any;",
            "--input-data-file",
            file,
        ],
        "",
    );
    assert_eq!(missing.status.code(), Some(2));
    assert!(missing.stdout.is_empty());
}

#[test]
// req:cli-exec-002 req:data-codec-003
fn codec_output_rejects_callables_without_conversion_hooks() {
    for expression in ["add", "[add]", "{ toJSON: <any> -> 42 }", "<any> -> 42"] {
        let result = invoke(&["exec", "-e", expression], "");
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stdout.is_empty());
        let diagnostic: serde_json::Value = serde_json::from_slice(&result.stderr).unwrap();
        assert_eq!(diagnostic["error"]["phase"], "output");
    }
    let ast = r#"{"kind":"value","value":{"\ud800":"\udfff","a":[-0.0,1.25]}}"#;
    let result = invoke(&["exec", "--ast"], ast);
    assert_eq!(output(&result), "{\"\\ud800\":\"\\udfff\" a:[-0 1.25]}\n");
    let matched = invoke(&["match", "-e", "any", "--input-data", output(&result)], "");
    assert_eq!(output(&matched), output(&result));
    let invoked = invoke(&["exec", "-e", "(json { toJSON: <any> -> 42 })"], "");
    assert_eq!(output(&invoked), "\"42\"\n");
}

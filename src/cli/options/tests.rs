use super::*;

#[test]
// req:cli-command-model-005 req:cli-match-002 req:cli-run-004
fn codec_subjects_preserve_their_stricter_repeated_option_contract() {
    for command in ["match", "run"] {
        for flag in [
            "--input",
            "--input-json",
            "--input-file",
            "--input-data",
            "--input-data-file",
        ] {
            let args = [command, "--input-data", "42", flag, "42"].map(str::to_owned);
            let error = parse(&args).err().expect("codec subject conflict");
            assert!(error.stderr.contains("mutually exclusive"));
        }
        let args = [command, "--input", "a", "--input", "b"].map(str::to_owned);
        assert_eq!(
            parse(&args)
                .unwrap_or_else(|error| panic!("{}", error.stderr))
                .text
                .as_deref(),
            Some("b")
        );
    }
}

#[test]
// req:cli-command-model-005 req:cli-command-model-002
fn repeated_options_take_the_last_value_and_mode_precedence_is_stable() {
    let args = ["--parse", "--mode", "exec", "--eval", "1", "-e", "42"].map(str::to_owned);
    let options = parse(&args).unwrap_or_else(|error| panic!("{}", error.stderr));
    assert_eq!(options.command, "exec");
    assert_eq!(options.source.as_deref(), Some("42"));
}

#[test]
// req:cli-command-model-005
fn unknown_flags_precede_semantic_validation_and_no_subject_file_is_opened() {
    let args = ["exec", "--input-file", "/missing", "--check", "--unknown"].map(str::to_owned);
    let error = parse(&args).err().expect("invalid options");
    let diagnostic: serde_json::Value = serde_json::from_str(&error.stderr).unwrap();
    assert_eq!(diagnostic["error"]["phase"], "parse");
    assert_eq!(diagnostic["error"]["message"], "Unknown flag: --unknown");
}

#[test]
// req:cli-command-model-005
fn persistent_reference_argument_matrix_matches_options_and_exact_errors() {
    let matrix: serde_json::Value = serde_json::from_str(include_str!(
        "../../../test/rust/cli-compatibility-matrix.json"
    ))
    .unwrap();
    let entries = matrix["arguments"].as_array().unwrap();
    assert!(entries.len() > 1500);
    for entry in entries {
        let args: Vec<String> = entry["args"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_str().unwrap().to_owned())
            .collect();
        let outcome = match parse(&args) {
            Ok(options) => serde_json::json!({
                "exitCode": 0,
                "options": {
                    "command": options.command, "paths": options.paths, "ast": options.ast,
                    "json": options.json, "check": options.check, "source": options.source,
                    "text": options.text, "inputJson": options.input_json,
                    "inputFile": options.input_file,
                    "language": options.language.as_deref().unwrap_or("uffda"),
                    "entry": options.entry, "config": options.config,
                }
            }),
            Err(error) => {
                let diagnostic: serde_json::Value = serde_json::from_str(&error.stderr).unwrap();
                serde_json::json!({"exitCode": error.exit_code, "error": diagnostic["error"]})
            }
        };
        assert_eq!(outcome, entry["expected"], "{}", entry["name"]);
    }
}

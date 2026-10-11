use crate::diagnostics::{self, SourceDiagnostic};
use crate::evaluate::Evaluation;
use crate::expression::Expression;
use crate::languages::{Language, Languages};
use crate::module::CompiledModuleGraph;
use crate::output::{serialized_json_output, serialized_output, uffda_output};
use crate::pattern::{MatchKind, Pattern};
use crate::project::Project;
use crate::resolver::{Resolver, decode_declaration};
use crate::runtime::{InputMode, Runtime};
use serde_json::json;
use std::rc::Rc;
use url::Url;

pub struct CliResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

fn failure(code: &str, phase: &str, message: impl ToString) -> CliResult {
    CliResult {
        exit_code: if code == "CLI_CONFIG" { 3 } else { 2 },
        stdout: String::new(),
        stderr: format!(
            "{}\n",
            json!({
                "ok": false, "error": { "code": code, "phase": phase, "message": message.to_string() }
            })
        ),
    }
}

fn success(stdout: String) -> CliResult {
    CliResult {
        exit_code: 0,
        stdout,
        stderr: String::new(),
    }
}

fn diagnostic_failure(
    diagnostics: &[SourceDiagnostic],
    path: &str,
    language: Option<&str>,
    json_output: bool,
) -> CliResult {
    if diagnostics.is_empty() {
        return failure(
            "CLI_EXEC_EXECUTION_FAILURE",
            "execute",
            "Runtime reported an unclean outcome without diagnostics",
        );
    }
    let payloads: Vec<_> = diagnostics.iter().map(|diagnostic| {
        if diagnostic.phase == "execute" {
            let mut value = json!({ "code": diagnostic.code, "phase": diagnostic.phase, "message": diagnostic.message });
            if diagnostic.code == "CLI_EXEC_RECOVERED" {
                value["span"] = json!({ "start": diagnostic.location.offset, "end": diagnostic.location.end_offset.unwrap_or(diagnostic.location.offset) });
            }
            value
        } else {
            let mut value = json!(diagnostic);
            value["sourcePath"] = json!(path);
            if let Some(language) = language { value["language"] = json!(language); }
            value
        }
    }).collect();
    let error_index = diagnostics
        .iter()
        .rposition(|diagnostic| {
            !matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery)
        })
        .unwrap_or(0);
    CliResult {
        exit_code: 2,
        stdout: String::new(),
        stderr: if json_output {
            format!(
                "{}\n",
                json!({ "ok": false, "error": payloads[error_index], "diagnostics": payloads })
            )
        } else {
            diagnostics
                .iter()
                .map(|diagnostic| {
                    format!(
                        "{}:{}:{}: {}\n",
                        path,
                        diagnostic.location.line + 1,
                        diagnostic.location.column + 1,
                        diagnostic.message
                    )
                })
                .collect()
        },
    }
}

const HELP: &str = "Usage: uffda <command> [options] [paths...]\n\nRust migration preview:\n  compile       Compile source files or globs to project artifacts.\n  parse         Parse source using --lang uffda, pattern, or expression.\n  exec          Evaluate expression source or --ast JSON.\n  match         Match pattern source or --ast JSON against input.\n  run           Execute an exported rule from module source or --ast syntax JSON.\n  fmt           Format files/globs, or '-' for .uff stdin, with language metadata.\n\nOptions:\n  -e, --eval    Inline source input.\n  --ast         Explicit raw AST JSON input (not compatible with --eval).\n  --json        JSON output, including string results.\n  --config      Explicit project configuration file.\n  --check       Check formatting without writes (fmt only).\n  --help, -h    Show usage.\n  --version, -V Show version.\n";

fn resolve_mode(args: &[String]) -> Result<(String, Vec<String>), String> {
    let commands = ["compile", "parse", "exec", "match", "run", "fmt"];
    let mut command = None;
    let mut flag_mode = None;
    let mut long_mode = None;
    let mut remaining = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let arg = args[index].as_str();
        if command.is_none() && commands.contains(&arg) {
            command = Some(arg.to_owned());
        } else if ["--compile", "--parse", "--match", "--run"].contains(&arg) {
            flag_mode = Some(arg.trim_start_matches("--").to_owned());
        } else if arg == "--mode" || arg.starts_with("--mode=") {
            let mode = if let Some((_, value)) = arg.split_once('=') {
                value
            } else {
                index += 1;
                args.get(index)
                    .map(String::as_str)
                    .ok_or("Missing value for --mode")?
            };
            if !commands.contains(&mode) {
                return Err(format!("Unknown --mode value: {mode}"));
            }
            long_mode = Some(mode.to_owned());
        } else {
            remaining.push(args[index].clone());
            if [
                "-e",
                "--eval",
                "--input",
                "--input-json",
                "--input-file",
                "--config",
                "--entry",
                "--lang",
            ]
            .contains(&arg)
            {
                index += 1;
                if let Some(value) = args.get(index) {
                    remaining.push(value.clone());
                }
            }
        }
        index += 1;
    }
    let selected = long_mode.or(flag_mode);
    if let (Some(command), Some(mode)) = (&command, &selected)
        && command != mode
    {
        return Err(format!(
            "Conflicting mode selection: command '{command}' does not match '{mode}'"
        ));
    }
    Ok((
        command.or(selected).unwrap_or_else(|| "compile".into()),
        remaining,
    ))
}

pub fn run(args: &[String], stdin: impl FnOnce() -> std::io::Result<String>) -> CliResult {
    let has_flag = |flags: &[&str]| {
        let mut index = 0;
        while index < args.len() {
            if flags.contains(&args[index].as_str()) {
                return true;
            }
            if [
                "-e",
                "--eval",
                "--input",
                "--input-json",
                "--input-file",
                "--lang",
                "--entry",
                "--config",
                "--mode",
            ]
            .contains(&args[index].as_str())
            {
                index += 1;
            }
            index += 1;
        }
        false
    };
    if args.is_empty() || has_flag(&["--help", "-h"]) {
        return success(HELP.into());
    }
    if has_flag(&["--version", "-V"]) {
        return success(format!("{}\n", env!("CARGO_PKG_VERSION")));
    }
    let (command, args) = match resolve_mode(args) {
        Ok(selected) => selected,
        Err(error) => return failure("CLI_USAGE", "validation", error),
    };
    let command = command.as_str();
    if command == "fmt" {
        return run_fmt(&args, stdin);
    }
    if !matches!(command, "exec" | "match" | "parse" | "run" | "compile") {
        return failure(
            "CLI_USAGE",
            "validation",
            format!("Rust command '{command}' is not implemented"),
        );
    }
    let mut ast = false;
    let mut json_output = false;
    let mut source = None;
    let mut path = None;
    let mut compile_paths = Vec::new();
    let mut subject = None;
    let mut subject_json = false;
    let mut language = Language::Uffda;
    let mut language_selected = false;
    let mut entry = None;
    let mut config = None;
    let mut index = 0;
    while index < args.len() {
        let (flag, inline) = args[index]
            .split_once('=')
            .map_or((args[index].as_str(), None), |(flag, value)| {
                (flag, Some(value))
            });
        match flag {
            "--ast" if inline.is_none() => ast = true,
            "--json" if inline.is_none() => json_output = true,
            "-e" | "--eval" | "--input" | "--input-json" | "--input-file" | "--lang"
            | "--entry" | "--config" => {
                let value = if let Some(value) = inline {
                    value.to_owned()
                } else {
                    index += 1;
                    let Some(value) = args.get(index) else {
                        return failure(
                            "CLI_USAGE",
                            "validation",
                            format!("Missing value for {flag}"),
                        );
                    };
                    value.clone()
                };
                if flag == "--config" {
                    config = Some(value);
                } else if flag == "--lang" {
                    if command != "parse" {
                        return failure(
                            "CLI_USAGE",
                            "validation",
                            format!("{command} selects its language and does not accept --lang"),
                        );
                    }
                    if language_selected {
                        return failure(
                            "CLI_USAGE",
                            "validation",
                            "Only one language selection is allowed",
                        );
                    }
                    language_selected = true;
                    language = match value.as_str() {
                        "uffda" => Language::Uffda,
                        "pattern" => Language::Pattern,
                        "expression" => Language::Expression,
                        _ => {
                            return failure(
                                "CLI_USAGE",
                                "validation",
                                format!("Unknown --lang value: {value}"),
                            );
                        }
                    };
                } else if flag == "--entry" {
                    if command != "run" {
                        return failure("CLI_USAGE", "validation", "--entry is only valid for run");
                    }
                    entry = Some(value);
                } else if flag == "-e" || flag == "--eval" {
                    if source.replace(value).is_some() {
                        return failure(
                            "CLI_USAGE",
                            "validation",
                            "Only one inline input is allowed",
                        );
                    }
                } else {
                    if !matches!(command, "match" | "run") || subject.is_some() {
                        return failure(
                            "CLI_USAGE",
                            "validation",
                            "Input options are mutually exclusive and only valid for match and run",
                        );
                    }
                    subject_json = flag == "--input-json";
                    subject = Some(if flag == "--input-file" {
                        match std::fs::read_to_string(value) {
                            Ok(value) => value,
                            Err(error) => return failure("CLI_USAGE", "input", error),
                        }
                    } else {
                        value
                    });
                }
            }
            "-" => {
                if command == "compile" {
                    return failure(
                        "CLI_USAGE",
                        "validation",
                        "compile requires file paths or globs, not stdin",
                    );
                }
                if path.replace("-".to_owned()).is_some() {
                    return failure("CLI_USAGE", "validation", "Expected one input path");
                }
            }
            value if !value.starts_with('-') => {
                if command == "compile" {
                    compile_paths.push(value.to_owned());
                    index += 1;
                    continue;
                }
                if path.replace(value.to_owned()).is_some() {
                    return failure("CLI_USAGE", "validation", "Expected one input path");
                }
            }
            _ => return failure("CLI_USAGE", "validation", format!("Unknown option: {flag}")),
        }
        index += 1;
    }
    if source.is_some() && path.is_some() {
        return failure(
            "CLI_USAGE",
            "validation",
            "Inline input and input paths cannot be combined",
        );
    }
    if ast && source.is_some() {
        return failure(
            "CLI_USAGE",
            "validation",
            "Cannot combine --ast with -e/--eval",
        );
    }
    if ast && command == "parse" {
        return failure(
            "CLI_USAGE",
            "validation",
            "parse accepts source input and cannot use --ast",
        );
    }
    if command == "match" && subject.is_none() {
        return failure(
            "CLI_USAGE",
            "validation",
            "match requires --input or --input-file",
        );
    }
    if command == "compile" && (ast || source.is_some() || compile_paths.is_empty()) {
        return failure(
            "CLI_USAGE",
            "validation",
            "compile requires source file paths or globs and cannot use --ast or --eval",
        );
    }
    let cwd = match std::env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let project_path = match Project::discover(&cwd, config.as_deref()) {
        Ok(path) => path,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let mut languages = None;
    let project = if let Some(path) = project_path {
        let mut grammar = match Languages::new() {
            Ok(grammar) => grammar,
            Err(error) => return failure("CLI_CONFIG", "configuration", error),
        };
        let project = match Project::load(path, &mut grammar) {
            Ok(project) => project,
            Err(error) => return failure("CLI_CONFIG", "configuration", error),
        };
        languages = Some(grammar);
        Some(project)
    } else {
        None
    };
    if command == "compile" {
        let mut grammar = match languages {
            Some(grammar) => grammar,
            None => match Languages::new() {
                Ok(grammar) => grammar,
                Err(error) => return failure("CLI_COMPILE_PARSE_FAILURE", error.phase, error),
            },
        };
        let default_out_dir = cwd.join("bin");
        let empty_imports = std::collections::BTreeMap::new();
        let result = crate::compile::compile(
            crate::compile::CompileRequest {
                cwd: &cwd,
                root: project
                    .as_ref()
                    .map_or(cwd.as_path(), |project| project.root.as_path()),
                out_dir: project
                    .as_ref()
                    .map_or(default_out_dir.as_path(), |project| {
                        project.out_dir.as_path()
                    }),
                paths: &compile_paths,
                imports: project
                    .as_ref()
                    .map_or(&empty_imports, |project| &project.imports),
                overwrite: false,
            },
            &mut grammar,
        );
        return match serde_json::to_string_pretty(&result) {
            Ok(output) => CliResult {
                exit_code: if result.ok { 0 } else { 2 },
                stdout: format!("{output}\n"),
                stderr: String::new(),
            },
            Err(error) => failure("CLI_COMPILE_WRITE_FAILURE", "output", error),
        };
    }
    let source_label = match path.as_deref() {
        Some("-") => "<stdin>",
        Some(path) => path,
        None if source.is_some() => "<eval>",
        None => "<stdin>",
    };
    let source = match source {
        Some(source) => source,
        None => {
            let input = match path.as_deref() {
                None | Some("-") => stdin(),
                Some(path) => std::fs::read_to_string(path),
            };
            match input {
                Ok(source) => source,
                Err(error) => return failure("CLI_USAGE", "input", error),
            }
        }
    };
    let mut parse_diagnostics = Vec::new();
    let ast_value: serde_json::Value = if ast {
        match serde_json::from_str(&source) {
            Ok(value) => value,
            Err(error) => return failure("CLI_EXEC_INVALID_JSON", "parse", error),
        }
    } else {
        let mut grammar = match languages.take() {
            Some(grammar) => grammar,
            None => match Languages::new() {
                Ok(grammar) => grammar,
                Err(error) => return failure("CLI_PARSE_FAILURE", error.phase, error),
            },
        };
        let language = match command {
            "exec" => Language::Expression,
            "match" => Language::Pattern,
            _ => language,
        };
        let parsed = match grammar.parse_source(&source, language) {
            Ok(parsed) => parsed,
            Err(error) if !error.diagnostics.is_empty() => {
                return diagnostic_failure(
                    &error.diagnostics,
                    source_label,
                    Some(language.id()),
                    true,
                );
            }
            Err(error) => return failure("CLI_PARSE_FAILURE", error.phase, error),
        };
        if !parsed.diagnostics.is_empty() && command != "parse" {
            return diagnostic_failure(
                &parsed.diagnostics,
                source_label,
                Some(language.id()),
                true,
            );
        }
        parse_diagnostics = parsed.diagnostics;
        languages = Some(grammar);
        parsed.value
    };
    if command == "parse" {
        match serde_json::to_string_pretty(&ast_value) {
            Ok(value) => {
                if parse_diagnostics.is_empty() {
                    success(format!("{value}\n"))
                } else {
                    let mut result = diagnostic_failure(
                        &parse_diagnostics,
                        source_label,
                        Some(language.id()),
                        true,
                    );
                    result.stdout = format!("{value}\n");
                    result
                }
            }
            Err(error) => failure("CLI_PARSE_FAILURE", "output", error),
        }
    } else if command == "run" {
        let mut grammar = match languages {
            Some(grammar) => grammar,
            None => match Languages::new() {
                Ok(grammar) => grammar,
                Err(error) => return failure("CLI_EXEC_COMPILATION_FAILURE", error.phase, error),
            },
        };
        let selected = entry.or_else(|| {
            ast_value
                .get("declarations")?
                .as_array()?
                .iter()
                .find(|declaration| declaration["kind"] == "export")?
                .get("name")?
                .as_str()
                .map(str::to_owned)
        });
        let declaration = match grammar.compile(ast_value) {
            Ok(declaration) => declaration,
            Err(error) => return failure("CLI_EXEC_COMPILATION_FAILURE", error.phase, error),
        };
        let origin = match path.as_deref() {
            Some(path) if path != "-" => cwd.join(path),
            _ => cwd.join("__uffda_input__.json"),
        };
        let url = match Url::from_file_path(origin) {
            Ok(url) => url,
            Err(()) => return failure("CLI_CONFIG", "configuration", "Invalid module origin"),
        };
        let mut resolver = match &project {
            Some(project) => match project.resolver() {
                Ok(resolver) => resolver,
                Err(error) => return failure("CLI_CONFIG", "configuration", error),
            },
            None => match Resolver::from_cwd() {
                Ok(resolver) => resolver,
                Err(error) => return failure("CLI_CONFIG", "configuration", error),
            },
        };
        let declaration = match decode_declaration(&url, &declaration.to_string()) {
            Ok(declaration) => declaration,
            Err(error) => return failure("CLI_EXEC_UNSUPPORTED_AST", "compile", error),
        };
        resolver.insert_declaration(url.clone(), declaration);
        let graph = match resolver.load_graph(&url) {
            Ok(graph) => graph,
            Err(error) => return failure("CLI_EXEC_COMPILATION_FAILURE", "resolve", error),
        };
        let graph = match CompiledModuleGraph::compile(graph) {
            Ok(graph) => Rc::new(graph),
            Err(error) => return failure("CLI_EXEC_COMPILATION_FAILURE", "compile", error),
        };
        let input_mode = if subject.is_none() {
            InputMode::Empty
        } else if subject_json {
            InputMode::Scalar
        } else {
            InputMode::Iterable
        };
        let diagnostic_source = subject.as_deref().unwrap_or("").to_owned();
        let input = match subject {
            None => serde_json::Value::Array(vec![]),
            Some(subject) if subject_json => match serde_json::from_str(&subject) {
                Ok(input) => input,
                Err(error) => return failure("CLI_MATCH_INVALID_JSON", "input", error),
            },
            Some(subject) => serde_json::Value::String(subject),
        };
        let mut runtime =
            match Runtime::with_mode(graph, &url, selected.as_deref(), input, input_mode) {
                Ok(runtime) => runtime,
                Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
            };
        if let Err(error) = runtime.run() {
            return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error);
        }
        let mut runtime_diagnostics = diagnostics::collect(
            &runtime,
            &diagnostic_source,
            "CLI_EXEC_RECOVERED",
            "CLI_EXEC_EXECUTION_FAILURE",
            "execute",
        );
        if let Some(position) = runtime.read(|execution| {
            execution
                .result()
                .filter(|result| result.kind == MatchKind::Fail)
                .map(|result| result.start)
        }) {
            for diagnostic in &mut runtime_diagnostics {
                if !matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery) {
                    diagnostic.message = format!("execution failed at {position}");
                }
            }
        }
        let finish = |mut result: CliResult| {
            if !runtime_diagnostics.is_empty() {
                let diagnostic = diagnostic_failure(&runtime_diagnostics, "<input>", None, true);
                result.exit_code = diagnostic.exit_code;
                result.stderr = diagnostic.stderr;
            }
            result
        };
        let direct = runtime.read(|execution| {
            let Some(result) = execution.result() else {
                return Some(failure(
                    "CLI_EXEC_EXECUTION_FAILURE",
                    "execute",
                    "Missing module result",
                ));
            };
            if result.kind == MatchKind::Fail {
                if !runtime_diagnostics.is_empty() {
                    return Some(diagnostic_failure(
                        &runtime_diagnostics,
                        "<input>",
                        None,
                        true,
                    ));
                }
                return Some(failure(
                    "CLI_EXEC_EXECUTION_FAILURE",
                    "execute",
                    format!("Execution failed at {}", result.end),
                ));
            }
            if json_output {
                return None;
            }
            Some(match uffda_output(result.value) {
                Ok(output) => success(output),
                Err(error) => failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
            })
        });
        if let Some(direct) = direct {
            return finish(direct);
        }
        match runtime.serialize_result() {
            Ok(text) => finish(success(serialized_json_output(text.as_deref()))),
            Err(error) => failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
        }
    } else if command == "exec" {
        let expression: Expression = match serde_json::from_value(ast_value) {
            Ok(expression) => expression,
            Err(error) => return failure("CLI_EXEC_UNSUPPORTED_AST", "parse", error),
        };
        let mut evaluation = Evaluation::with_cli_globals(expression);
        let result = match evaluation.finish() {
            Ok(result) => result,
            Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
        };
        let direct =
            match evaluation.read(&result, |value| (!json_output).then(|| uffda_output(value))) {
                Ok(direct) => direct,
                Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
            };
        if let Some(direct) = direct {
            return match direct {
                Ok(output) => success(output),
                Err(error) => failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
            };
        }
        let serialized = match evaluation.serialize_rooted(&result) {
            Ok(serialized) => serialized,
            Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
        };
        match evaluation.read(&serialized, serialized_output) {
            Ok(Ok(output)) => success(output),
            Ok(Err(error)) => failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
            Err(error) => failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
        }
    } else {
        let pattern: Pattern = match serde_json::from_value(ast_value) {
            Ok(pattern) => pattern,
            Err(error) => return failure("CLI_MATCH_UNSUPPORTED_AST", "parse", error),
        };
        let subject = subject.unwrap_or_default();
        let parsed_subject = if subject_json {
            match serde_json::from_str(&subject) {
                Ok(value) => value,
                Err(error) => return failure("CLI_MATCH_INVALID_JSON", "input", error),
            }
        } else {
            serde_json::Value::String(subject)
        };
        match_ast(
            pattern,
            parsed_subject,
            subject_json,
            json_output,
            (!ast).then_some(source.as_str()),
        )
    }
}

fn run_fmt(args: &[String], stdin: impl FnOnce() -> std::io::Result<String>) -> CliResult {
    let mut paths = Vec::new();
    let mut check = false;
    let mut json = false;
    let mut config = None;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--check" => check = true,
            "--json" => json = true,
            "--config" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return failure("CLI_USAGE", "validation", "Missing --config value");
                };
                config = Some(value.clone());
            }
            value if value.starts_with("--config=") => {
                config = Some(value["--config=".len()..].to_owned())
            }
            "-" => paths.push("-".into()),
            value if !value.starts_with('-') => paths.push(value.to_owned()),
            value => {
                return failure(
                    "CLI_USAGE",
                    "validation",
                    format!("Unknown fmt option: {value}"),
                );
            }
        }
        index += 1;
    }
    let input = paths.iter().any(|path| path == "-");
    if input && paths.len() != 1 {
        return failure(
            "CLI_USAGE",
            "validation",
            "fmt stdin cannot be combined with paths",
        );
    }
    let cwd = match std::env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let mut grammar = match Languages::new() {
        Ok(grammar) => grammar,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let project = match Project::discover(&cwd, config.as_deref()) {
        Ok(Some(path)) => match Project::load(path, &mut grammar) {
            Ok(project) => Some(project),
            Err(error) => return failure("CLI_CONFIG", "configuration", error),
        },
        Ok(None) => None,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    if let Some(project) = &project {
        grammar = match project
            .resolver()
            .map_err(|error| error.to_string())
            .and_then(|resolver| {
                Languages::with_resolver(resolver).map_err(|error| error.to_string())
            }) {
            Ok(grammar) => grammar,
            Err(error) => return failure("CLI_CONFIG", "configuration", error),
        };
    }
    let languages = match grammar.project_languages(project.as_ref()) {
        Ok(languages) => languages,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let result = if input {
        let source = match stdin() {
            Ok(source) => source,
            Err(error) => return failure("CLI_USAGE", "input", error),
        };
        // Stdin always uses the built-in .uff grammar, even when a project overrides it.
        let builtin = match grammar.project_languages(None) {
            Ok(builtin) => builtin,
            Err(error) => return failure("CLI_CONFIG", "configuration", error),
        };
        crate::format::stdin(&mut grammar, &builtin[0], &source, check)
    } else {
        crate::format::files(&mut grammar, &languages, &cwd, &paths, check)
    };
    let stdout = if json {
        match serde_json::to_string_pretty(&result) {
            Ok(output) => format!("{output}\n"),
            Err(error) => return failure("CLI_FMT_FORMAT_FAILURE", "output", error),
        }
    } else if input {
        result.text.clone().unwrap_or_default()
    } else {
        result
            .files
            .iter()
            .filter(|file| file.status == "changed")
            .map(|file| format!("{}\n", file.source_path))
            .collect()
    };
    let stderr = if json {
        String::new()
    } else {
        result
            .files
            .iter()
            .flat_map(|file| {
                file.diagnostics
                    .iter()
                    .map(move |diagnostic| match &diagnostic.location {
                        Some(location) => format!(
                            "{}:{}:{}: {}\n",
                            file.source_path,
                            location.line + 1,
                            location.column + 1,
                            diagnostic.message
                        ),
                        None => format!("{}: {}\n", file.source_path, diagnostic.message),
                    })
            })
            .collect()
    };
    CliResult {
        exit_code: if result.ok { 0 } else { 2 },
        stdout,
        stderr,
    }
}

fn source_excerpt(source: &str, offset: usize) -> String {
    let mut units = 0;
    let mut byte_offset = source.len();
    for (index, character) in source.char_indices() {
        if units >= offset {
            byte_offset = index;
            break;
        }
        units += character.len_utf16();
    }
    let start = source[..byte_offset]
        .rfind('\n')
        .map_or(0, |index| index + 1);
    let end = source[byte_offset..]
        .find('\n')
        .map_or(source.len(), |index| byte_offset + index);
    let line = source[..start]
        .chars()
        .filter(|character| *character == '\n')
        .count()
        + 1;
    let column = source[start..byte_offset].encode_utf16().count();
    format!(
        "{line} | {}\n{} | {}^\n",
        &source[start..end],
        " ".repeat(line.to_string().len()),
        " ".repeat(column)
    )
}

fn match_ast(
    pattern: Pattern,
    subject: serde_json::Value,
    scalar: bool,
    json_output: bool,
    source: Option<&str>,
) -> CliResult {
    let subject_text = subject.as_str().unwrap_or("").to_owned();
    let mode = if scalar {
        InputMode::Scalar
    } else {
        InputMode::Iterable
    };
    let mut runtime = match Runtime::for_pattern(pattern, subject, mode) {
        Ok(runtime) => runtime,
        Err(error) => return failure("CLI_MATCH_FAILURE", "match", error),
    };
    if let Err(error) = runtime.run() {
        return failure("CLI_MATCH_FAILURE", "match", error);
    }
    let Some(kind) = runtime.read(|execution| execution.result().map(|result| result.kind)) else {
        return failure("CLI_MATCH_FAILURE", "match", "Missing match result");
    };
    let focused = runtime.read(|execution| {
        let diagnostic = execution.rightmost_failure()?;
        let matched = execution.failure_match()?;
        Some((
            diagnostic.kind.as_str(),
            diagnostic.position.to_string(),
            matched.current().is_none(),
        ))
    });
    let diagnostics = diagnostics::collect(
        &runtime,
        &subject_text,
        "CLI_MATCH_RECOVERED",
        "CLI_MATCH_FAILURE",
        "match",
    );
    let mut payloads = Vec::new();
    let mut human = String::new();
    for diagnostic in &diagnostics {
        if matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery) {
            let span = json!({ "start": diagnostic.location.offset, "end": diagnostic.location.end_offset.unwrap_or(diagnostic.location.offset) });
            payloads.push(json!({ "code": "CLI_MATCH_RECOVERED", "phase": "match", "message": diagnostic.message, "inputSpan": span }));
            human.push_str(&format!(
                "Match recovered at input {}..{}: {}\n",
                diagnostic.location.offset,
                diagnostic
                    .location
                    .end_offset
                    .unwrap_or(diagnostic.location.offset),
                diagnostic.message
            ));
        } else {
            let Some((pattern, position, eof)) = &focused else {
                return failure(
                    "CLI_MATCH_FAILURE",
                    "match",
                    "Failed match has no retained diagnostic node",
                );
            };
            let message = format!("Pattern '{pattern}' did not match input at {position}");
            let description = if *eof {
                "end of input"
            } else {
                "a value that did not match"
            };
            let mut payload = json!({ "code": "CLI_MATCH_FAILURE", "phase": "match", "message": message, "inputPosition": position, "inputDescription": description });
            human.push_str(&format!(
                "Match failure: {message}\nInput {position}: {description}.\n"
            ));
            if let Some(source) = source {
                payload["source"] = json!(source);
                if *pattern == "over"
                    && let Some(index) = source.find('{')
                {
                    let offset = source[..index].encode_utf16().count();
                    payload["sourceOffset"] = json!(offset);
                    human.push_str(&source_excerpt(source, offset));
                }
            }
            payloads.push(payload);
        }
    }
    let output = if kind == MatchKind::Fail {
        String::new()
    } else {
        let direct = runtime.read(|execution| {
            let value = execution.result().expect("completed match").value;
            (!json_output).then(|| uffda_output(value))
        });
        match direct {
            Some(Ok(output)) => output,
            Some(Err(error)) => return failure("CLI_MATCH_FAILURE", "output", error),
            None => match runtime.serialize_result() {
                Ok(text) => serialized_json_output(text.as_deref()),
                Err(error) => return failure("CLI_MATCH_FAILURE", "output", error),
            },
        }
    };
    if payloads.is_empty() {
        if kind == MatchKind::Fail {
            return failure(
                "CLI_MATCH_FAILURE",
                "match",
                "Failed match has no diagnostics",
            );
        }
        return success(output);
    }
    let error = if kind == MatchKind::Fail {
        payloads.last().expect("non-empty diagnostics")
    } else {
        &payloads[0]
    };
    CliResult {
        exit_code: 2,
        stdout: output,
        stderr: if json_output {
            format!(
                "{}\n",
                json!({ "ok": false, "error": error, "diagnostics": payloads })
            )
        } else {
            human
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn execute(args: &[&str]) -> CliResult {
        run(
            &args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>(),
            || Ok(String::new()),
        )
    }

    #[test]
    // req:cli-command-model-001 req:cli-exec-001
    fn help_version_and_inline_expression() {
        assert_eq!(execute(&[]).exit_code, 0);
        assert!(execute(&["--help"]).stdout.contains("exec"));
        assert_eq!(execute(&["--version"]).stdout, "0.0.0\n");
        let result = run(&["exec".into(), "--ast".into()], || {
            Ok(r#"{"kind":"number","value":42}"#.into())
        });
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "42\n");
        let result = execute(&["exec", "-e", "--help"]);
        assert_ne!(result.exit_code, 0);
        assert!(!result.stdout.contains("Usage"));
        let result = execute(&["match", "-e", "any", "--input", "--version"]);
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "-\n");
    }

    #[test]
    // req:cli-exec-001 req:cli-command-model-002
    fn invalid_json_source_and_conflicts_fail_explicitly() {
        for args in [
            vec!["exec", "--ast", "-e", "{"],
            vec!["exec", "-e", "("],
            vec!["exec", "--ast", "-e", "{}", "file.json"],
            vec!["exec", "--lang", "expression"],
            vec![
                "parse",
                "--lang",
                "pattern",
                "--lang",
                "expression",
                "-e",
                "42",
            ],
            vec!["match", "--ast", "--input", "a", "--input-json", "42"],
        ] {
            let result = execute(&args);
            assert_ne!(result.exit_code, 0);
            assert!(result.stdout.is_empty());
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&result.stderr).unwrap()["ok"],
                false
            );
        }
    }

    #[test]
    // req:cli-command-model-002
    fn mode_precedence_conflicts_and_values_are_preserved() {
        let resolve =
            |args: &[&str]| resolve_mode(&args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>());
        assert_eq!(
            resolve(&["--parse", "--mode", "exec", "--ast"]).unwrap(),
            ("exec".into(), vec!["--ast".into()])
        );
        assert!(
            resolve(&["exec", "--match"])
                .unwrap_err()
                .contains("Conflicting")
        );
        assert_eq!(resolve(&["file.uff"]).unwrap().0, "compile");
        assert_eq!(
            resolve(&["--mode=match", "--input", "exec"]).unwrap(),
            ("match".into(), vec!["--input".into(), "exec".into()])
        );
    }

    #[test]
    // req:cli-match-001
    fn diagnostic_source_excerpt_uses_utf16_columns() {
        assert_eq!(
            source_excerpt("first\n😀{ x }", 8),
            "2 | 😀{ x }\n  |   ^\n"
        );
    }

    #[test]
    // req:cli-match-001
    fn json_subject_is_scalar_and_text_subject_is_iterable() {
        let result = run(
            &[
                "match".into(),
                "--ast".into(),
                "--input-json".into(),
                "42".into(),
            ],
            || Ok(r#"{"kind":"type","type":"number"}"#.into()),
        );
        assert_eq!(result.stdout, "42\n", "{}", result.stderr);
        let result = run(
            &[
                "match".into(),
                "--ast".into(),
                "--input".into(),
                "ab".into(),
            ],
            || Ok(r#"{"kind":"any"}"#.into()),
        );
        assert_eq!(result.stdout, "a\n", "{}", result.stderr);
        let result = run(
            &[
                "match".into(),
                "--ast".into(),
                "--input".into(),
                "42".into(),
            ],
            || Ok(r#"{"kind":"type","type":"number"}"#.into()),
        );
        assert_ne!(result.exit_code, 0);
    }
}

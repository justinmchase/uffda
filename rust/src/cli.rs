use crate::codec::data::{DataDecoder, DataDocument, DataLimits};
use crate::diagnostics::{self, SourceDiagnostic};
use crate::evaluate::Evaluation;
use crate::expression::Expression;
use crate::languages::{Language, Languages};
use crate::module::CompiledModuleGraph;
use crate::output::{codec_output, serialized_json_output, serialized_output};
use crate::pattern::{MatchKind, Pattern};
use crate::project::Project;
use crate::resolver::{Resolver, decode_declaration};
use crate::runtime::{InputMode, Runtime};
use serde_json::json;
use std::rc::Rc;
use url::Url;

mod options;

pub struct CliResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

fn failure(code: &str, phase: &str, message: impl ToString) -> CliResult {
    let error = json!({ "code": code, "phase": phase, "message": message.to_string() });
    let mut payload = json!({ "ok": false, "error": error });
    if code == "CLI_EXEC_EXECUTION_FAILURE" && phase == "execute" {
        payload["diagnostics"] = json!([error]);
    }
    CliResult {
        exit_code: if code == "CLI_CONFIG" { 3 } else { 2 },
        stdout: String::new(),
        stderr: format!("{}\n", payload),
    }
}

fn success(stdout: String) -> CliResult {
    CliResult {
        exit_code: 0,
        stdout,
        stderr: String::new(),
    }
}

enum Subject {
    Json(crate::json::JsonValue, InputMode),
    Data(DataDocument),
}

fn decode_subject(source: Option<&str>, json: bool, data: bool) -> Result<Subject, CliResult> {
    let Some(source) = source else {
        return Ok(Subject::Json(
            crate::json::JsonValue::Array(vec![]),
            InputMode::Empty,
        ));
    };
    if data {
        let decode = || -> Result<DataDocument, String> {
            let mut decoder = DataDecoder::new(DataLimits::default()).map_err(|e| e.to_string())?;
            let mut bytes = source.as_bytes();
            let mut document = None;
            while !bytes.is_empty() {
                let (consumed, record) = decoder.push_some(bytes).map_err(|e| e.to_string())?;
                bytes = &bytes[consumed..];
                if let Some(record) = record
                    && document.replace(record.document).is_some()
                {
                    return Err("Expected exactly one codec data subject record".into());
                }
            }
            if let Some(record) = decoder.finish().map_err(|e| e.to_string())?
                && document.replace(record.document).is_some()
            {
                return Err("Expected exactly one codec data subject record".into());
            }
            document.ok_or_else(|| "Expected exactly one codec data subject record".into())
        };
        return decode()
            .map(Subject::Data)
            .map_err(|error| failure("CLI_MATCH_INVALID_DATA", "input", error));
    }
    if json {
        crate::json::from_str(source)
            .map(|value| Subject::Json(value, InputMode::Scalar))
            .map_err(|error| failure("CLI_MATCH_INVALID_JSON", "input", error))
    } else {
        Ok(Subject::Json(
            crate::json::JsonValue::String(source.into()),
            InputMode::Iterable,
        ))
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

const HELP: &str = "\
Usage: uffda <command> [options] [paths...]

Rust migration preview:
  compile       Compile source files or globs to project artifacts.
  parse         Parse source using --lang uffda, pattern, or expression.
  exec          Evaluate expression source or --ast JSON.
  match         Match pattern source or --ast JSON against input.
  run           Execute an exported rule from module source or --ast syntax JSON.
  fmt           Format files/globs, or '-' for .uff stdin, with language metadata.

Options:
  -e, --eval         Inline program source input.
  --ast              Explicit raw program AST JSON (not compatible with --eval).
  --input            Inline text subject (match/run).
  --input-file       Text subject file (match/run).
  --input-json       One inline JSON subject value (match/run).
  --input-data       One inline codec data subject value (match/run).
  --input-data-file  One codec data subject value from a file (match/run).
                     Subject options are mutually exclusive; data is never evaluated.
  --json             JSON output; exec/match/run otherwise emit codec data records,
                     including quoted strings and undefined.
  --config           Explicit project configuration file.
  --lang             uffda | pattern | expression (parse only).
  --mode             compile | exec | fmt | match | parse | run.
  --entry            Exported rule to run (run only).
  --check            Check formatting without writes (fmt only).
  --help, -h         Show usage.
  --version, -V      Show version.
";

fn help(args: &[String]) -> String {
    let mut target = None;
    let mut index = 0;
    while index < args.len() {
        let token = args[index].as_str();
        let selected = if token == "--mode" {
            index += 1;
            args.get(index).map(String::as_str)
        } else {
            Some(
                if ["--compile", "--parse", "--match", "--run"].contains(&token) {
                    &token[2..]
                } else {
                    token.strip_prefix("--mode=").unwrap_or(token)
                },
            )
        };
        if let Some(selected) = selected
            && options::COMMANDS.contains(&selected)
        {
            target = Some(selected);
        }
        index += 1;
    }
    let usage = match target {
        Some("compile") => "Usage: uffda compile [options] <file-or-glob> [...more paths]",
        Some("exec") => "Usage: uffda exec [--ast] [expression-path|-]",
        Some("fmt") => {
            "Usage: uffda fmt [--check] [--json] [--config <path>] [file-or-glob|-] [...]"
        }
        Some("match") => "Usage: uffda match [--ast] [pattern-path|-] --input <text>",
        Some("parse") => "Usage: uffda parse [options] [source-path|-]",
        Some("run") => "Usage: uffda run [--ast] [module-path|-] [--entry <rule>]",
        _ => return HELP.into(),
    };
    let mut text = format!("{usage}\n\n");
    text.push_str(match target {
        Some("compile") => "Compile source files or globs to ModuleDeclaration JSON under <outDir>/ast.\n",
        Some("fmt") => "Format source files in place, or .uff stdin with '-'. --check lists changed\nfiles without writing. Files that do not parse cleanly are never rewritten.\n",
        Some("parse") => "Read one source unit from a path, stdin, or inline input and emit its raw AST.\n",
        Some("exec") => "Evaluate expression source or explicit AST JSON.\n",
        Some("match") => "Match pattern source or explicit AST JSON against one selected subject.\n",
        Some("run") => "Run module source or explicit syntax AST JSON. The first exported rule is the\ndefault entry. With no subject option, the rule matches empty input.\n",
        _ => unreachable!("recognized help target"),
    });
    if matches!(target, Some("exec" | "match" | "run")) {
        text.push_str("Default output is a codec data record, including quoted strings and undefined.\n--json selects JSON-compatible results and diagnostics.\n");
    }
    text.push_str("\nOptions:\n  --help, -h       Show command usage.\n  --json           Machine-readable output and diagnostics.\n");
    if matches!(target, Some("parse" | "exec" | "match" | "run")) {
        text.push_str("  -e, --eval       Inline program source (otherwise a path or stdin).\n");
    }
    if matches!(target, Some("exec" | "match" | "run")) {
        text.push_str("  --ast            Raw AST JSON from a path or stdin, not inline source.\n");
    }
    if matches!(target, Some("compile" | "exec" | "fmt" | "run")) {
        text.push_str("  --config         Project file; defaults to the nearest uffda.jsonc.\n");
    }
    if matches!(target, Some("match" | "run")) {
        text.push_str("  --input          Inline text subject.\n  --input-file     Text subject file.\n  --input-json     One inline JSON subject value.\n  --input-data     One inline codec data subject value.\n  --input-data-file One codec data subject value from a file.\n                   Subject transports are mutually exclusive.\n");
    }
    match target {
        Some("parse") => text.push_str("  --lang           uffda | pattern | expression.\n"),
        Some("run") => text.push_str("  --entry          Exported rule to run.\n"),
        Some("fmt") => text.push_str("  --check          Check formatting without writes.\n"),
        _ => {}
    }
    text
}

fn effective_cwd() -> Result<std::path::PathBuf, CliResult> {
    let cwd =
        std::env::current_dir().map_err(|error| failure("CLI_CONFIG", "configuration", error))?;
    for name in ["INIT_CWD", "PWD"] {
        match std::env::var_os(name) {
            Some(value) if !value.is_empty() => {
                let path = cwd.join(value);
                return Url::from_directory_path(&path)
                    .map_err(|()| {
                        failure(
                            "CLI_CONFIG",
                            "configuration",
                            "Invalid working-directory context",
                        )
                    })?
                    .to_file_path()
                    .map_err(|()| {
                        failure(
                            "CLI_CONFIG",
                            "configuration",
                            "Invalid working-directory context",
                        )
                    });
            }
            _ => {}
        }
    }
    Ok(cwd)
}

fn load_project(
    cwd: &std::path::Path,
    config: Option<&str>,
    languages: &mut Option<Languages>,
) -> Result<Option<Project>, CliResult> {
    let path = Project::discover(cwd, config)
        .map_err(|error| failure("CLI_CONFIG", "configuration", error))?;
    let Some(path) = path else {
        return Ok(None);
    };
    if languages.is_none() {
        *languages =
            Some(Languages::new().map_err(|error| failure("CLI_CONFIG", "configuration", error))?);
    }
    Project::load(path, languages.as_mut().expect("initialized languages"))
        .map(Some)
        .map_err(|error| failure("CLI_CONFIG", "configuration", error))
}

pub fn run(args: &[String], stdin: impl FnOnce() -> std::io::Result<String>) -> CliResult {
    let has_flag = |flags: &[&str]| args.iter().any(|arg| flags.contains(&arg.as_str()));
    if args.is_empty() || has_flag(&["--help", "-h"]) {
        return success(help(args));
    }
    if has_flag(&["--version", "-V"]) {
        return success(format!("{}\n", env!("CARGO_PKG_VERSION")));
    }
    let cwd = match effective_cwd() {
        Ok(cwd) => cwd,
        Err(error) => return error,
    };
    let options = match options::parse(args) {
        Ok(options) => options,
        Err(error) => return error,
    };
    let command = options.command.as_str();
    if command == "fmt" {
        return run_fmt(options, &cwd, stdin);
    }
    let ast = options.ast;
    let json_output = options.json;
    let source = options.source;
    let path = options.paths.first().cloned();
    let compile_paths = options.paths;
    let entry = options.entry;
    let config = options.config;
    let language = match options.language.as_deref() {
        Some("pattern") => Language::Pattern,
        Some("expression") => Language::Expression,
        _ => Language::Uffda,
    };
    let subject_json = options.input_json.is_some();
    let subject_data = options.data.is_some() || options.data_file.is_some();
    let subject_path = options.input_file.or(options.data_file);
    let subject = options.text.or(options.input_json).or(options.data);
    if command == "compile" && compile_paths.is_empty() {
        return failure(
            "CLI_USAGE",
            "validation",
            "Compile mode requires at least one file path or glob pattern.",
        );
    }
    let mut languages = None;
    if command == "compile" {
        let project = match load_project(&cwd, config.as_deref(), &mut languages) {
            Ok(project) => project,
            Err(error) => return error,
        };
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
        Some(path) if path != "-" => cwd.join(path).display().to_string(),
        _ if source.is_some() => "<eval>".into(),
        _ => "<stdin>".into(),
    };
    let source = match source {
        Some(source) => source,
        None => {
            let input = match path.as_deref() {
                None | Some("-") => stdin(),
                Some(path) => std::fs::read_to_string(cwd.join(path)),
            };
            match input {
                Ok(source) => source,
                Err(error) => {
                    return failure(
                        "CLI_USAGE",
                        "validation",
                        format!("Unable to read input {source_label}: {error}"),
                    );
                }
            }
        }
    };
    let mut parse_diagnostics = Vec::new();
    let ast_value: crate::json::JsonValue = if ast {
        match crate::json::from_str(&source) {
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
                    &source_label,
                    Some(language.id()),
                    true,
                );
            }
            Err(error) => return failure("CLI_PARSE_FAILURE", error.phase, error),
        };
        if !parsed.diagnostics.is_empty() && command != "parse" {
            return diagnostic_failure(
                &parsed.diagnostics,
                &source_label,
                Some(language.id()),
                true,
            );
        }
        parse_diagnostics = parsed.diagnostics;
        languages = Some(grammar);
        parsed.value
    };
    let project = if matches!(command, "exec" | "run") {
        match load_project(&cwd, config.as_deref(), &mut languages) {
            Ok(project) => project,
            Err(error) => return error,
        }
    } else {
        None
    };
    let subject = match subject_path {
        Some(path) => {
            let path = cwd.join(path);
            match std::fs::read_to_string(&path) {
                Ok(value) => Some(value),
                Err(error) => {
                    return failure(
                        "CLI_USAGE",
                        "validation",
                        format!("Unable to read {command} input {}: {error}", path.display()),
                    );
                }
            }
        }
        None => subject,
    };
    if command == "match" && subject.is_none() {
        return failure(
            "CLI_USAGE",
            "validation",
            "match requires --input or --input-file",
        );
    }
    let diagnostic_source = subject.as_deref().unwrap_or("").to_owned();
    let parsed_subject = match decode_subject(subject.as_deref(), subject_json, subject_data) {
        Ok(subject) => subject,
        Err(error) => return error,
    };
    if command == "parse" {
        match serde_json::to_string_pretty(&ast_value) {
            Ok(value) => {
                if parse_diagnostics.is_empty() {
                    success(format!("{value}\n"))
                } else {
                    let mut result = diagnostic_failure(
                        &parse_diagnostics,
                        &source_label,
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
            None => match Resolver::new(cwd.clone(), cwd.join("bin")) {
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
        let runtime = match parsed_subject {
            Subject::Json(input, mode) => {
                Runtime::with_mode(graph, &url, selected.as_deref(), input, mode)
            }
            Subject::Data(input) => Runtime::with_data(graph, &url, selected.as_deref(), &input),
        };
        let mut runtime = match runtime {
            Ok(runtime) => runtime,
            Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
        };
        if let Err(error) = runtime.run() {
            return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error);
        }
        let mut runtime_diagnostics = match diagnostics::collect(
            &runtime,
            &diagnostic_source,
            "CLI_EXEC_RECOVERED",
            "CLI_EXEC_EXECUTION_FAILURE",
            "execute",
        ) {
            Ok(diagnostics) => diagnostics,
            Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "output", error),
        };
        if let Some(position) = runtime.read(|execution| {
            execution
                .result()
                .filter(|result| result.kind == MatchKind::Fail)
                .map(|result| result.start)
        }) {
            for diagnostic in &mut runtime_diagnostics {
                if !matches!(diagnostic.kind, crate::runtime::DiagnosticKind::Recovery) {
                    diagnostic.message = format!("execution failed at [{position}]");
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
            Some(match codec_output(result.value) {
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
        let expression: Expression = match crate::json::from_value(ast_value) {
            Ok(expression) => expression,
            Err(error) => return failure("CLI_EXEC_UNSUPPORTED_AST", "parse", error),
        };
        let mut evaluation = Evaluation::with_cli_globals(expression);
        let result = match evaluation.finish() {
            Ok(result) => result,
            Err(error) => return failure("CLI_EXEC_EXECUTION_FAILURE", "execute", error),
        };
        let direct =
            match evaluation.read(&result, |value| (!json_output).then(|| codec_output(value))) {
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
        let pattern: Pattern = match crate::json::from_value(ast_value) {
            Ok(pattern) => pattern,
            Err(error) => return failure("CLI_MATCH_UNSUPPORTED_AST", "parse", error),
        };
        match_ast(
            pattern,
            parsed_subject,
            json_output,
            (!ast).then_some(source.as_str()),
        )
    }
}

fn run_fmt(
    options: options::Options,
    cwd: &std::path::Path,
    stdin: impl FnOnce() -> std::io::Result<String>,
) -> CliResult {
    let paths = options.paths;
    let check = options.check;
    let json = options.json;
    let config = options.config;
    let input = paths.iter().any(|path| path == "-");
    let mut grammar = match Languages::new() {
        Ok(grammar) => grammar,
        Err(error) => return failure("CLI_CONFIG", "configuration", error),
    };
    let project = match Project::discover(cwd, config.as_deref()) {
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
        crate::format::files(&mut grammar, &languages, cwd, &paths, check)
    };
    let stdout = if json {
        match serde_json::to_string_pretty(&result) {
            Ok(output) => format!("{output}\n"),
            Err(error) => return failure("CLI_FMT_FORMAT_FAILURE", "output", error),
        }
    } else if input {
        if check && result.files.iter().any(|file| file.status == "changed") {
            "<stdin>\n".into()
        } else {
            result.text.clone().unwrap_or_default()
        }
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
    subject: Subject,
    json_output: bool,
    source: Option<&str>,
) -> CliResult {
    let subject_text = match &subject {
        Subject::Json(crate::json::JsonValue::String(text), _) => text.clone(),
        _ => crate::text::RuntimeString::default(),
    };
    let runtime = match subject {
        Subject::Json(input, mode) => Runtime::for_pattern(pattern, input, mode),
        Subject::Data(input) => Ok(Runtime::for_pattern_data(pattern, &input)),
    };
    let mut runtime = match runtime {
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
            matched.identity.position(matched.start).to_string(),
            matched.current().is_none(),
        ))
    });
    let diagnostics = match diagnostics::collect(
        &runtime,
        &subject_text,
        "CLI_MATCH_RECOVERED",
        "CLI_MATCH_FAILURE",
        "match",
    ) {
        Ok(diagnostics) => diagnostics,
        Err(error) => return failure("CLI_MATCH_FAILURE", "output", error),
    };
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
            (!json_output).then(|| codec_output(value))
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

    #[test]
    // req:cli-command-model-005
    fn contextual_help_describes_only_applicable_inputs_and_preview_output() {
        let parse = help(&["parse".into(), "--help".into()]);
        assert!(parse.starts_with("Usage: uffda parse"));
        assert!(parse.contains("--lang"));
        assert!(!parse.contains("--config"));
        assert!(!parse.contains("--ast"));
        let run = help(&["--help".into(), "--eval".into(), "run".into()]);
        assert!(run.starts_with("Usage: uffda run"));
        assert!(run.contains("--entry"));
        assert!(run.contains("quoted strings and undefined"));
        assert!(!help(&["--exec".into(), "--help".into()]).starts_with("Usage: uffda exec"));
    }

    #[test]
    // req:runtime-strings-002
    fn ast_and_source_commands_preserve_surrogates_or_report_scalar_output_errors() {
        let result = run(&["exec".into(), "--ast".into(), "--json".into()], || {
            Ok(r#"{"kind":"value","value":{"\ud800":"\udfff"}}"#.into())
        });
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert!(result.stdout.contains(r#""\ud800": "\udfff""#));
        let result = run(
            &[
                "exec".into(),
                "--json".into(),
                "-e".into(),
                "(at \"😀\" 0)".into(),
            ],
            || Ok(String::new()),
        );
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "\"\\ud83d\"\n");
        let result = run(
            &["exec".into(), "-e".into(), "(at \"😀\" 0)".into()],
            || Ok(String::new()),
        );
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "\"\\ud83d\"\n");
        let result = run(
            &[
                "match".into(),
                "--ast".into(),
                "--json".into(),
                "--input-json".into(),
                r#""\ud800""#.into(),
            ],
            || Ok(r#"{"kind":"any"}"#.into()),
        );
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "\"\\ud800\"\n");
    }

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
        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.starts_with("Usage: uffda exec"));
        let result = execute(&["match", "-e", "any", "--input", "--version"]);
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.stdout, "0.0.0\n");
    }

    #[test]
    // req:cli-exec-001 req:cli-command-model-002
    fn invalid_json_source_and_conflicts_fail_explicitly() {
        for args in [
            vec!["exec", "--ast", "-e", "{"],
            vec!["exec", "-e", "("],
            vec!["exec", "--ast", "-e", "{}", "file.json"],
            vec!["exec", "--lang", "expression"],
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
        let resolve = |args: &[&str]| {
            options::parse(&args.iter().map(|arg| (*arg).into()).collect::<Vec<_>>())
        };
        assert_eq!(
            resolve(&["--parse", "--mode", "exec", "--ast"])
                .unwrap_or_else(|e| panic!("{}", e.stderr))
                .command,
            "exec"
        );
        assert!(
            resolve(&["exec", "--match"])
                .err()
                .unwrap()
                .stderr
                .contains("Conflicting")
        );
        assert_eq!(
            resolve(&["file.uff"])
                .unwrap_or_else(|e| panic!("{}", e.stderr))
                .command,
            "compile"
        );
        let options = resolve(&["--mode=match", "--input", "exec"])
            .unwrap_or_else(|e| panic!("{}", e.stderr));
        assert_eq!(options.command, "match");
        assert_eq!(options.text.as_deref(), Some("exec"));
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
        assert_eq!(result.stdout, "\"a\"\n", "{}", result.stderr);
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
    #[test]
    // req:cli-command-model-004
    fn reference_validation_fixtures_preserve_exact_diagnostic_objects() {
        let fixtures: serde_json::Value =
            serde_json::from_str(include_str!("../../test/rust/cli-validation-fixtures.json"))
                .unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let args = fixture["args"]
                .as_array()
                .unwrap()
                .iter()
                .map(|arg| arg.as_str().unwrap().to_owned())
                .collect::<Vec<_>>();
            let result = run(&args, || panic!("validation must not read stdin"));
            assert_eq!(result.exit_code, 2, "{}", fixture["name"]);
            assert!(result.stdout.is_empty(), "{}", fixture["name"]);
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&result.stderr).unwrap(),
                json!({
                    "ok": false,
                    "error": {"code":"CLI_USAGE", "phase":fixture["phase"], "message":fixture["message"]}
                }),
                "{}",
                fixture["name"]
            );
        }
    }
}

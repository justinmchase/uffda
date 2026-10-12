use super::{CliResult, failure};

pub(super) const COMMANDS: [&str; 6] = ["compile", "exec", "fmt", "match", "parse", "run"];

#[derive(Default)]
pub(super) struct Options {
    pub command: String,
    pub paths: Vec<String>,
    pub ast: bool,
    pub json: bool,
    pub check: bool,
    pub source: Option<String>,
    pub text: Option<String>,
    pub input_json: Option<String>,
    pub input_file: Option<String>,
    pub data: Option<String>,
    pub data_file: Option<String>,
    pub language: Option<String>,
    pub entry: Option<String>,
    pub config: Option<String>,
    subject_occurrences: usize,
}

pub(super) fn parse(args: &[String]) -> Result<Options, CliResult> {
    let mut options = Options::default();
    let mut command = None;
    let mut long_mode = None;
    let mut flag_mode = None;
    let mut index = 0;
    while index < args.len() {
        let token = &args[index];
        let (flag, inline) = token
            .split_once('=')
            .map_or((token.as_str(), None), |(f, v)| (f, Some(v)));
        if token == "-" || !token.starts_with('-') {
            if command.is_none() && COMMANDS.contains(&token.as_str()) {
                command = Some(token.clone());
            } else {
                options.paths.push(token.clone());
            }
        } else {
            if matches!(
                flag,
                "--input" | "--input-json" | "--input-file" | "--input-data" | "--input-data-file"
            ) {
                options.subject_occurrences += 1;
            }
            match flag {
                "--ast" if inline.is_none() => options.ast = true,
                "--json" if inline.is_none() => options.json = true,
                "--check" if inline.is_none() => options.check = true,
                "--compile" | "--parse" | "--match" | "--run" if inline.is_none() => {
                    flag_mode = Some(flag[2..].to_owned());
                }
                "--mode" | "--lang" | "--config" | "-e" | "--eval" | "--input" | "--input-json"
                | "--input-file" | "--entry" | "--input-data" | "--input-data-file" => {
                    let value = if let Some(value) = inline {
                        value.to_owned()
                    } else {
                        index += 1;
                        args.get(index).cloned().ok_or_else(|| {
                            failure("CLI_USAGE", "parse", format!("Missing value for {flag}"))
                        })?
                    };
                    if value.is_empty()
                        && (flag == "--config"
                            || (inline.is_none() && matches!(flag, "--mode" | "--lang")))
                    {
                        return Err(failure(
                            "CLI_USAGE",
                            "parse",
                            format!("Missing value for {flag}"),
                        ));
                    }
                    match flag {
                        "--mode" => {
                            if !COMMANDS.contains(&value.as_str()) {
                                return Err(failure(
                                    "CLI_USAGE",
                                    "parse",
                                    format!("Unknown --mode value: {value}"),
                                ));
                            }
                            long_mode = Some(value);
                        }
                        "--lang" => {
                            if !["uffda", "pattern", "expression"].contains(&value.as_str()) {
                                return Err(failure(
                                    "CLI_USAGE",
                                    "parse",
                                    format!("Unknown --lang value: {value}"),
                                ));
                            }
                            options.language = Some(value);
                        }
                        "--config" => options.config = Some(value),
                        "-e" | "--eval" => options.source = Some(value),
                        "--input" => options.text = Some(value),
                        "--input-json" => options.input_json = Some(value),
                        "--input-file" => options.input_file = Some(value),
                        "--input-data" => options.data = Some(value),
                        "--input-data-file" => options.data_file = Some(value),
                        "--entry" => options.entry = Some(value),
                        _ => unreachable!(),
                    }
                }
                _ => {
                    return Err(failure(
                        "CLI_USAGE",
                        "parse",
                        format!("Unknown flag: {token}"),
                    ));
                }
            }
        }
        index += 1;
    }
    let mode = long_mode.or(flag_mode);
    if let (Some(command), Some(mode)) = (&command, &mode)
        && command != mode
    {
        return Err(failure(
            "CLI_USAGE",
            "validation",
            format!("Conflicting mode selection: command '{command}' does not match '{mode}'"),
        ));
    }
    options.command = command.or(mode).unwrap_or_else(|| "compile".into());
    validate(&options)?;
    Ok(options)
}

fn validate(options: &Options) -> Result<(), CliResult> {
    let command = options.command.as_str();
    let subject_count = [
        &options.text,
        &options.input_json,
        &options.input_file,
        &options.data,
        &options.data_file,
    ]
    .into_iter()
    .filter(|value| value.is_some())
    .count();
    let message = if command == "fmt" {
        if options.ast
            || options.source.is_some()
            || options.language.is_some()
            || options.entry.is_some()
            || subject_count > 0
        {
            Some("fmt accepts only paths, globs, -, --check, --json, and --config".into())
        } else if options.paths.iter().any(|path| path == "-") && options.paths.len() > 1 {
            Some("fmt cannot combine - with file paths".into())
        } else {
            None
        }
    } else if options.check {
        Some("--check is only valid for fmt".into())
    } else if command != "compile" && options.paths.len() > 1 {
        Some(format!(
            "{command} accepts at most one source or AST input path"
        ))
    } else if command != "compile" && options.source.is_some() && !options.paths.is_empty() {
        Some(format!(
            "{command} cannot combine -e/--eval with an input path"
        ))
    } else if command != "compile" && options.ast && options.source.is_some() {
        Some(format!("{command} cannot combine --ast with -e/--eval"))
    } else if command == "parse" && options.ast {
        Some("parse accepts source input and cannot use --ast".into())
    } else if command == "compile" && (options.ast || options.source.is_some()) {
        Some("compile does not accept --ast, -e, or --eval".into())
    } else if command != "parse" && options.language.is_some() {
        Some(format!(
            "{command} selects its language and does not accept --lang"
        ))
    } else if !matches!(command, "match" | "run") && subject_count > 0 {
        Some(if options.data.is_some() || options.data_file.is_some() {
            "Input options are mutually exclusive and only valid for match and run".into()
        } else {
            "--input, --input-json, and --input-file are only valid for match and run".into()
        })
    } else if subject_count > 1
        || ((options.data.is_some() || options.data_file.is_some())
            && options.subject_occurrences > 1)
    {
        Some(if options.data.is_some() || options.data_file.is_some() {
            "Input options are mutually exclusive and only valid for match and run".into()
        } else {
            format!("{command} accepts only one of --input, --input-json, or --input-file")
        })
    } else if command != "run"
        && options
            .entry
            .as_ref()
            .is_some_and(|value| !value.is_empty())
    {
        Some("--entry is only valid for run".into())
    } else if matches!(command, "match" | "parse") && options.config.is_some() {
        Some("--config is only valid for compile, exec, fmt, and run".into())
    } else {
        None
    };
    match message {
        Some(message) => Err(failure("CLI_USAGE", "validation", message)),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests;

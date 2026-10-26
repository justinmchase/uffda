use crate::languages::Languages;
use crate::resolver::graph::unfurl_specifier;
use crate::resolver::normalize_path;
use crate::source_paths::{expand, stable_path};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use url::Url;

const COMPILE_WORKERS: usize = 2;
const PREFETCH_CAPACITY: usize = 2;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileFailure {
    pub code: &'static str,
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<crate::diagnostics::SourceLocation>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileSuccess {
    pub source_path: String,
    pub output_path: String,
    pub module_codec: String,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum CompileUnit {
    Success {
        ok: bool,
        #[serde(flatten)]
        success: CompileSuccess,
    },
    Failure {
        ok: bool,
        #[serde(rename = "sourcePath")]
        source_path: String,
        #[serde(rename = "outputPath", skip_serializing_if = "Option::is_none")]
        output_path: Option<String>,
        failure: CompileFailure,
        #[serde(skip_serializing_if = "Option::is_none")]
        diagnostics: Option<Vec<CompileFailure>>,
    },
}

#[derive(Serialize)]
pub struct CompileResult {
    pub ok: bool,
    pub units: Vec<CompileUnit>,
    pub successes: Vec<CompileSuccess>,
    pub failures: Vec<CompileFailure>,
}

impl CompileResult {
    fn fail_diagnostics(&mut self, diagnostics: Vec<CompileFailure>) {
        let first = diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code != "CLI_COMPILE_PARSE_RECOVERED")
            .or_else(|| diagnostics.first())
            .expect("non-empty failure diagnostics");
        self.ok = false;
        self.units.push(CompileUnit::Failure {
            ok: false,
            source_path: first.source_path.clone(),
            output_path: first.output_path.clone(),
            failure: first.clone(),
            diagnostics: Some(diagnostics.clone()),
        });
        self.failures.extend(diagnostics);
    }

    fn fail(&mut self, failure: CompileFailure) {
        self.ok = false;
        self.units.push(CompileUnit::Failure {
            ok: false,
            source_path: failure.source_path.clone(),
            output_path: failure.output_path.clone(),
            failure: failure.clone(),
            diagnostics: None,
        });
        self.failures.push(failure);
    }
}

pub struct CompileRequest<'a> {
    pub cwd: &'a Path,
    pub root: &'a Path,
    pub out_dir: &'a Path,
    pub paths: &'a [String],
    pub imports: &'a BTreeMap<String, String>,
    pub overwrite: bool,
}

pub fn compile(request: CompileRequest<'_>, languages: &mut Languages) -> CompileResult {
    let mut result = CompileResult {
        ok: true,
        units: vec![],
        successes: vec![],
        failures: vec![],
    };
    let failure =
        |code, source_path: String, output_path: Option<&Path>, message: String| CompileFailure {
            code,
            source_path,
            output_path: output_path.map(|path| path.to_string_lossy().into_owned()),
            message,
            location: None,
        };
    if [request.cwd, request.root, request.out_dir]
        .iter()
        .any(|path| !path.is_absolute())
    {
        result.fail(failure(
            "CLI_COMPILE_INVALID_CONTEXT",
            request.paths.first().cloned().unwrap_or_default(),
            None,
            "cwd and the artifact layout must be absolute paths".into(),
        ));
        return result;
    }
    let normalized = [request.cwd, request.root, request.out_dir].map(normalize_path);
    let [Ok(cwd), Ok(root), Ok(out_dir)] = normalized else {
        result.fail(failure(
            "CLI_COMPILE_INVALID_CONTEXT",
            request.paths.first().cloned().unwrap_or_default(),
            None,
            "cwd and the artifact layout must be absolute paths".into(),
        ));
        return result;
    };
    let expanded = expand(&cwd, request.paths, &[]);
    for error in expanded.failures {
        result.fail(failure(
            if error.not_found {
                "CLI_COMPILE_SOURCE_NOT_FOUND"
            } else {
                "CLI_COMPILE_SOURCE_NOT_READABLE"
            },
            error.source_path,
            None,
            error.message,
        ));
    }
    let mut plans = Vec::new();
    let mut outputs = BTreeSet::new();
    for source in expanded.files {
        let source = match normalize_path(&source) {
            Ok(source) => source,
            Err(error) => {
                result.fail(failure(
                    "CLI_COMPILE_SOURCE_NOT_READABLE",
                    stable_path(&cwd, &source),
                    None,
                    error.to_string(),
                ));
                continue;
            }
        };
        let source_path = stable_path(&cwd, &source);
        let relative = match source.strip_prefix(&root) {
            Ok(path) if !path.as_os_str().is_empty() => path,
            _ => {
                result.fail(failure(
                    "CLI_COMPILE_SOURCE_OUTSIDE_ROOT",
                    source_path,
                    None,
                    format!("{} is outside {}", source.display(), root.display()),
                ));
                continue;
            }
        };
        let output = out_dir.join("ast").join(relative).with_extension("uff.ast");
        if !outputs.insert(output.clone()) {
            result.fail(failure(
                "CLI_COMPILE_OUTPUT_COLLISION",
                source_path,
                Some(&output),
                format!("Multiple source paths map to {}", output.display()),
            ));
            continue;
        }
        plans.push((source, source_path, output));
    }
    if plans.is_empty() {
        return result;
    }

    let imports = request.imports.clone();
    let overwrite = request.overwrite;

    // Single unit: keep the caller's warm Languages heap; no worker pool needed.
    if plans.len() == 1 {
        let (source, source_path, output) = plans.pop().expect("len checked");
        match prepare_and_read(&source, &source_path, &output, overwrite) {
            Err(failure) => result.fail(*failure),
            Ok(text) => match compile_text(
                languages,
                &source,
                source_path,
                &output,
                &text,
                &imports,
                overwrite,
            ) {
                Ok(success) => {
                    result.units.push(CompileUnit::Success {
                        ok: true,
                        success: success.clone(),
                    });
                    result.successes.push(success);
                }
                Err(UnitFailure::Single(failure)) => result.fail(*failure),
                Err(UnitFailure::Many(diagnostics)) => result.fail_diagnostics(diagnostics),
            },
        }
        return result;
    }

    let (prefetch_tx, prefetch_rx) = mpsc::sync_channel::<Prefetched>(PREFETCH_CAPACITY);
    let reader = thread::spawn(move || {
        for (index, (source, source_path, output)) in plans.into_iter().enumerate() {
            let item = match prepare_and_read(&source, &source_path, &output, overwrite) {
                Ok(text) => Prefetched {
                    index,
                    source,
                    source_path,
                    output,
                    text: Ok(text),
                },
                Err(failure) => Prefetched {
                    index,
                    source,
                    source_path,
                    output,
                    text: Err(failure),
                },
            };
            if prefetch_tx.send(item).is_err() {
                break;
            }
        }
    });

    let prefetch_rx = Arc::new(Mutex::new(prefetch_rx));
    let (result_tx, result_rx) = mpsc::channel::<(usize, UnitOutcome)>();
    let worker_count = COMPILE_WORKERS;

    thread::scope(|scope| {
        for _ in 0..worker_count {
            let prefetch_rx = Arc::clone(&prefetch_rx);
            let result_tx = result_tx.clone();
            let imports = imports.clone();
            scope.spawn(move || {
                let mut languages = match Languages::new() {
                    Ok(languages) => languages,
                    Err(error) => {
                        let _ = result_tx.send((
                            0,
                            UnitOutcome::Failed(UnitFailure::Single(Box::new(CompileFailure {
                                code: "CLI_COMPILE_INVALID_CONTEXT",
                                source_path: String::new(),
                                output_path: None,
                                message: error.to_string(),
                                location: None,
                            }))),
                        ));
                        return;
                    }
                };
                loop {
                    let item = {
                        let receiver = prefetch_rx.lock().expect("prefetch lock");
                        receiver.recv()
                    };
                    let item = match item {
                        Ok(item) => item,
                        Err(RecvError) => break,
                    };
                    let outcome = match item.text {
                        Err(failure) => UnitOutcome::Failed(UnitFailure::Single(failure)),
                        Ok(text) => match compile_text(
                            &mut languages,
                            &item.source,
                            item.source_path,
                            &item.output,
                            &text,
                            &imports,
                            overwrite,
                        ) {
                            Ok(success) => UnitOutcome::Succeeded(success),
                            Err(failure) => UnitOutcome::Failed(failure),
                        },
                    };
                    if result_tx.send((item.index, outcome)).is_err() {
                        break;
                    }
                }
            });
        }
        drop(result_tx);

        let mut ordered = BTreeMap::new();
        for (index, outcome) in result_rx {
            ordered.insert(index, outcome);
        }
        for (_index, outcome) in ordered {
            match outcome {
                UnitOutcome::Succeeded(success) => {
                    result.units.push(CompileUnit::Success {
                        ok: true,
                        success: success.clone(),
                    });
                    result.successes.push(success);
                }
                UnitOutcome::Failed(UnitFailure::Single(failure)) => result.fail(*failure),
                UnitOutcome::Failed(UnitFailure::Many(diagnostics)) => {
                    result.fail_diagnostics(diagnostics)
                }
            }
        }
    });

    let _ = reader.join();
    result
}

struct Prefetched {
    index: usize,
    source: PathBuf,
    source_path: String,
    output: PathBuf,
    text: Result<String, Box<CompileFailure>>,
}

enum UnitOutcome {
    Succeeded(CompileSuccess),
    Failed(UnitFailure),
}

enum UnitFailure {
    Single(Box<CompileFailure>),
    Many(Vec<CompileFailure>),
}

fn prepare_and_read(
    source: &Path,
    source_path: &str,
    output: &Path,
    overwrite: bool,
) -> Result<String, Box<CompileFailure>> {
    match output.metadata() {
        Ok(metadata) if metadata.is_file() && !overwrite => {
            return Err(Box::new(CompileFailure {
                code: "CLI_COMPILE_OUTPUT_EXISTS",
                source_path: source_path.into(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: "Output already exists and overwrite=false".into(),
                location: None,
            }));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(Box::new(CompileFailure {
                code: "CLI_COMPILE_WRITE_FAILURE",
                source_path: source_path.into(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: error.to_string(),
                location: None,
            }));
        }
    }
    std::fs::read_to_string(source).map_err(|error| {
        Box::new(CompileFailure {
            code: "CLI_COMPILE_SOURCE_NOT_READABLE",
            source_path: source_path.into(),
            output_path: Some(output.to_string_lossy().into_owned()),
            message: error.to_string(),
            location: None,
        })
    })
}

fn compile_text(
    languages: &mut Languages,
    source: &Path,
    source_path: String,
    output: &Path,
    text: &str,
    imports: &BTreeMap<String, String>,
    overwrite: bool,
) -> Result<CompileSuccess, UnitFailure> {
    let module = match languages.compile_source_native(text) {
        Ok(module) => module,
        Err(error) => {
            if !error.diagnostics.is_empty() {
                return Err(UnitFailure::Many(
                    error
                        .diagnostics
                        .into_iter()
                        .map(|diagnostic| CompileFailure {
                            code: if diagnostic.code == "CLI_STREAM_PARSE_RECOVERED" {
                                "CLI_COMPILE_PARSE_RECOVERED"
                            } else {
                                "CLI_COMPILE_PARSE_FAILURE"
                            },
                            source_path: source_path.clone(),
                            output_path: Some(output.to_string_lossy().into_owned()),
                            message: diagnostic.message,
                            location: Some(diagnostic.location),
                        })
                        .collect(),
                ));
            }
            return Err(UnitFailure::Single(Box::new(CompileFailure {
                code: "CLI_COMPILE_PARSE_FAILURE",
                source_path,
                output_path: Some(output.to_string_lossy().into_owned()),
                message: error.to_string(),
                location: None,
            })));
        }
    };
    let _url = Url::from_file_path(source).map_err(|()| {
        UnitFailure::Single(Box::new(CompileFailure {
            code: "CLI_COMPILE_INVALID_CONTEXT",
            source_path: source_path.clone(),
            output_path: Some(output.to_string_lossy().into_owned()),
            message: "Invalid source URL".into(),
            location: None,
        }))
    })?;
    let codec_text = module
        .encode(false, crate::codec::data::DataLimits::default())
        .map_err(|error| {
            UnitFailure::Single(Box::new(CompileFailure {
                code: "CLI_COMPILE_PARSE_FAILURE",
                source_path: source_path.clone(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: error.to_string(),
                location: None,
            }))
        })?;
    let mut declaration: crate::resolver::ModuleDeclaration =
        crate::codec::declaration::decode_declaration_codec_as(&codec_text).map_err(|error| {
            UnitFailure::Single(Box::new(CompileFailure {
                code: "CLI_COMPILE_PARSE_FAILURE",
                source_path: source_path.clone(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: error,
                location: None,
            }))
        })?;
    let mut diagnostics = Vec::new();
    for import in &mut declaration.imports {
        let specifier = match import.field("moduleUrl") {
            Ok(value) => value.and_then(|value| value.string_value()),
            Err(error) => {
                diagnostics.push(CompileFailure {
                    code: "CLI_COMPILE_PARSE_FAILURE",
                    source_path: source_path.clone(),
                    output_path: Some(output.to_string_lossy().into_owned()),
                    message: format!("Invalid import declaration: {error}"),
                    location: None,
                });
                continue;
            }
        };
        let Some(specifier) = specifier else {
            diagnostics.push(CompileFailure {
                code: "CLI_COMPILE_PARSE_FAILURE",
                source_path: source_path.clone(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: "Import has no module URL".into(),
                location: None,
            });
            continue;
        };
        match unfurl_specifier(imports, &specifier) {
            Ok(full) => {
                let replacement = crate::codec::data::DataDocument::from_nodes(
                    vec![crate::codec::data::DataNode::String(full.into())],
                    0,
                    crate::codec::data::DataLimits::default(),
                )
                .map_err(|error| {
                    UnitFailure::Single(Box::new(CompileFailure {
                        code: "CLI_COMPILE_PARSE_FAILURE",
                        source_path: source_path.clone(),
                        output_path: Some(output.to_string_lossy().into_owned()),
                        message: error.to_string(),
                        location: None,
                    }))
                })?;
                *import = import
                    .replace_root_field(
                        "moduleUrl",
                        &replacement,
                        crate::codec::data::DataLimits::default(),
                    )
                    .map_err(|error| {
                        UnitFailure::Single(Box::new(CompileFailure {
                            code: "CLI_COMPILE_PARSE_FAILURE",
                            source_path: source_path.clone(),
                            output_path: Some(output.to_string_lossy().into_owned()),
                            message: error.to_string(),
                            location: None,
                        }))
                    })?;
            }
            Err(error) => {
                diagnostics.push(CompileFailure {
                    code: "CLI_COMPILE_UNDECLARED_MODULE_NAME",
                    source_path: source_path.clone(),
                    output_path: Some(output.to_string_lossy().into_owned()),
                    message: error,
                    location: None,
                });
            }
        }
    }
    if !diagnostics.is_empty() {
        return Err(UnitFailure::Many(diagnostics));
    }
    let module_codec = crate::codec::declaration::encode_declaration_documents(&declaration)
        .map_err(|error| {
            UnitFailure::Single(Box::new(CompileFailure {
                code: "CLI_COMPILE_PARSE_FAILURE",
                source_path: source_path.clone(),
                output_path: Some(output.to_string_lossy().into_owned()),
                message: error,
                location: None,
            }))
        })?;
    let write = || -> Result<(), String> {
        std::fs::create_dir_all(output.parent().ok_or("Output has no parent")?)
            .map_err(|error| error.to_string())?;
        write_artifact(output, module_codec.as_bytes(), overwrite)?;
        Ok(())
    };
    if let Err(error) = write() {
        return Err(UnitFailure::Single(Box::new(CompileFailure {
            code: "CLI_COMPILE_WRITE_FAILURE",
            source_path,
            output_path: Some(output.to_string_lossy().into_owned()),
            message: error,
            location: None,
        })));
    }
    Ok(CompileSuccess {
        source_path,
        output_path: output.to_string_lossy().into_owned(),
        module_codec,
    })
}

fn write_artifact(path: &Path, bytes: &[u8], overwrite: bool) -> Result<(), String> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true);
    if overwrite {
        options.create(true).truncate(true);
    } else {
        options.create_new(true);
    }
    let mut file = options.open(path).map_err(|error| error.to_string())?;
    file.write_all(bytes).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:cli-bootstrap-034 req:cli-compile-006
    fn recovered_source_produces_ordered_diagnostics_without_an_artifact() {
        let root =
            std::env::temp_dir().join(format!("uffda-compile-recovery-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("main.uff"), "export Main; rule Main = any").unwrap();
        let out_dir = root.join("bin");
        let imports = BTreeMap::new();
        let mut languages = Languages::new().unwrap();
        let result = compile(
            CompileRequest {
                cwd: &root,
                root: &root,
                out_dir: &out_dir,
                paths: &["main.uff".into()],
                imports: &imports,
                overwrite: false,
            },
            &mut languages,
        );
        assert!(!result.ok);
        assert_eq!(result.units.len(), 1);
        assert_eq!(result.failures[0].code, "CLI_COMPILE_PARSE_RECOVERED");
        assert!(result.failures[0].location.is_some());
        assert!(!out_dir.exists());
        let value = serde_json::to_value(&result).unwrap();
        assert_eq!(
            value["units"][0]["diagnostics"].as_array().unwrap().len(),
            1
        );
        std::fs::remove_file(root.join("main.uff")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    // req:project-file-003 req:cli-command-model-003
    fn relative_context_is_rejected_before_source_or_output_access() {
        let mut languages = Languages::new().unwrap();
        let imports = BTreeMap::new();
        let result = compile(
            CompileRequest {
                cwd: Path::new("."),
                root: Path::new("."),
                out_dir: Path::new("bin"),
                paths: &["main.uff".into()],
                imports: &imports,
                overwrite: false,
            },
            &mut languages,
        );
        assert!(!result.ok);
        assert_eq!(result.failures[0].code, "CLI_COMPILE_INVALID_CONTEXT");
        assert!(result.successes.is_empty());
    }

    #[test]
    // req:project-file-003 req:cli-bootstrap-034 req:cli-compile-002 req:cli-compile-008
    fn compilation_writes_module_declarations_in_mirrored_layout_and_refuses_overwrite() {
        let root = std::env::temp_dir().join(format!("uffda-compile-{}", std::process::id()));
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(root.join("src/main.uff"), "export Main; rule Main = any;").unwrap();
        let paths = vec!["src/*.uff".into()];
        let imports = BTreeMap::new();
        let out = root.join("build");
        let request = || CompileRequest {
            cwd: &root,
            root: &root,
            out_dir: &out,
            paths: &paths,
            imports: &imports,
            overwrite: false,
        };
        let mut languages = Languages::new().unwrap();
        let result = compile(request(), &mut languages);
        assert!(result.ok, "{}", serde_json::to_string(&result).unwrap());
        let output = out.join("ast/src/main.uff.ast");
        let codec_text = std::fs::read_to_string(&output).unwrap();
        let codec_module: crate::resolver::ModuleDeclaration =
            crate::codec::declaration::decode_declaration_codec_as(&codec_text).unwrap();
        assert_eq!(
            codec_module.rules[0]
                .field("name")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref(),
            Some("Main")
        );
        assert!(!out.join("ast/src/main.uff.ast.json").exists());
        let result_json = serde_json::to_value(&result).unwrap();
        assert_eq!(result_json["successes"][0]["moduleCodec"], codec_text);
        let result = compile(request(), &mut languages);
        assert!(!result.ok);
        assert_eq!(result.failures[0].code, "CLI_COMPILE_OUTPUT_EXISTS");
        std::fs::remove_file(output).unwrap();
        std::fs::remove_file(root.join("src/main.uff")).unwrap();
        for directory in ["build/ast/src", "build/ast", "build", "src"] {
            std::fs::remove_dir(root.join(directory)).unwrap();
        }
        std::fs::remove_dir(root).unwrap();
    }
}

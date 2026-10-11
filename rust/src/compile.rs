use crate::languages::{Language, Languages};
use crate::resolver::graph::unfurl_specifier;
use crate::resolver::{decode_declaration, normalize_path};
use crate::source_paths::{expand, stable_path};
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::path::Path;
use url::Url;

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
    pub module: Value,
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
        let output = out_dir
            .join("ast")
            .join(relative)
            .with_extension("uffda.ast.json");
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
    for (source, source_path, output) in plans {
        match output.metadata() {
            Ok(metadata) if metadata.is_file() && !request.overwrite => {
                result.fail(failure(
                    "CLI_COMPILE_OUTPUT_EXISTS",
                    source_path,
                    Some(&output),
                    "Output already exists and overwrite=false".into(),
                ));
                continue;
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                result.fail(failure(
                    "CLI_COMPILE_WRITE_FAILURE",
                    source_path,
                    Some(&output),
                    error.to_string(),
                ));
                continue;
            }
        }
        let text = match std::fs::read_to_string(&source) {
            Ok(text) => text,
            Err(error) => {
                result.fail(failure(
                    "CLI_COMPILE_SOURCE_NOT_READABLE",
                    source_path,
                    Some(&output),
                    error.to_string(),
                ));
                continue;
            }
        };
        let mut module = match languages
            .parse(&text, Language::Uffda)
            .and_then(|syntax| languages.compile(syntax))
        {
            Ok(module) => module,
            Err(error) => {
                if !error.diagnostics.is_empty() {
                    result.fail_diagnostics(
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
                    );
                    continue;
                }
                result.fail(failure(
                    "CLI_COMPILE_PARSE_FAILURE",
                    source_path,
                    Some(&output),
                    error.to_string(),
                ));
                continue;
            }
        };
        let url = match Url::from_file_path(&source) {
            Ok(url) => url,
            Err(()) => {
                result.fail(failure(
                    "CLI_COMPILE_INVALID_CONTEXT",
                    source_path,
                    Some(&output),
                    "Invalid source URL".into(),
                ));
                continue;
            }
        };
        if let Err(error) = decode_declaration(&url, &module.to_string()) {
            result.fail(failure(
                "CLI_COMPILE_PARSE_FAILURE",
                source_path,
                Some(&output),
                error.to_string(),
            ));
            continue;
        }
        let mut diagnostics = Vec::new();
        for import in module["imports"]
            .as_array_mut()
            .expect("validated declaration imports")
        {
            let Some(specifier) = import["moduleUrl"].as_str() else {
                diagnostics.push(failure(
                    "CLI_COMPILE_PARSE_FAILURE",
                    source_path.clone(),
                    Some(&output),
                    "Import has no module URL".into(),
                ));
                continue;
            };
            match unfurl_specifier(request.imports, specifier) {
                Ok(full) => import["moduleUrl"] = Value::String(full),
                Err(error) => {
                    diagnostics.push(failure(
                        "CLI_COMPILE_UNDECLARED_MODULE_NAME",
                        source_path.clone(),
                        Some(&output),
                        error,
                    ));
                }
            }
        }
        if !diagnostics.is_empty() {
            result.fail_diagnostics(diagnostics);
            continue;
        }
        let write = || -> Result<(), String> {
            let text = serde_json::to_string_pretty(&module).map_err(|error| error.to_string())?;
            std::fs::create_dir_all(output.parent().ok_or("Output has no parent")?)
                .map_err(|error| error.to_string())?;
            let mut options = std::fs::OpenOptions::new();
            options.write(true);
            if request.overwrite {
                options.create(true).truncate(true);
            } else {
                options.create_new(true);
            }
            let mut file = options.open(&output).map_err(|error| error.to_string())?;
            file.write_all(text.as_bytes())
                .map_err(|error| error.to_string())?;
            Ok(())
        };
        if let Err(error) = write() {
            result.fail(failure(
                "CLI_COMPILE_WRITE_FAILURE",
                source_path,
                Some(&output),
                error,
            ));
            continue;
        }
        let success = CompileSuccess {
            source_path,
            output_path: output.to_string_lossy().into_owned(),
            module,
        };
        result.units.push(CompileUnit::Success {
            ok: true,
            success: success.clone(),
        });
        result.successes.push(success);
    }
    result
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
    // req:project-file-003 req:cli-bootstrap-034
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
        let output = out.join("ast/src/main.uffda.ast.json");
        let module: Value =
            serde_json::from_str(&std::fs::read_to_string(&output).unwrap()).unwrap();
        assert!(module.get("kind").is_none());
        assert_eq!(module["rules"][0]["name"], "Main");
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

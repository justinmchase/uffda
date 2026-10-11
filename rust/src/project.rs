use crate::languages::Languages;
use crate::resolver::Resolver;
use crate::resolver::packages::{JsrPackages, Lockfile};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fmt;
use std::path::{Path, PathBuf};

pub struct Project {
    pub path: PathBuf,
    pub root: PathBuf,
    pub imports: BTreeMap<String, String>,
    pub exports: BTreeMap<String, String>,
    pub languages: Vec<String>,
    pub out_dir: PathBuf,
}

#[derive(Debug)]
pub struct ProjectError {
    pub path: PathBuf,
    pub problems: Vec<String>,
}

impl fmt::Display for ProjectError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:\n{}", self.path.display(), self.problems.join("\n"))
    }
}

impl std::error::Error for ProjectError {}

fn under_alias(name: &str, alias: &str) -> bool {
    name == alias
        || name
            .strip_prefix(alias)
            .is_some_and(|rest| rest.starts_with('/'))
}

impl Project {
    pub fn discover(start: &Path, explicit: Option<&str>) -> Result<Option<PathBuf>, ProjectError> {
        if let Some(explicit) = explicit {
            let path = start.join(explicit);
            return match path.metadata() {
                Ok(metadata) if metadata.is_file() => Ok(Some(path)),
                Ok(_) => Err(ProjectError {
                    path,
                    problems: vec!["Configuration path must be a file".into()],
                }),
                Err(error) => Err(ProjectError {
                    path,
                    problems: vec![error.to_string()],
                }),
            };
        }
        for directory in start.ancestors() {
            let path = directory.join("uffda.jsonc");
            match path.metadata() {
                Ok(metadata) if metadata.is_file() => return Ok(Some(path)),
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(ProjectError {
                        path,
                        problems: vec![error.to_string()],
                    });
                }
            }
        }
        Ok(None)
    }

    pub fn load(path: PathBuf, languages: &mut Languages) -> Result<Self, ProjectError> {
        let text = std::fs::read_to_string(&path).map_err(|error| ProjectError {
            path: path.clone(),
            problems: vec![error.to_string()],
        })?;
        Self::parse(&text, path, languages)
    }

    pub fn parse(text: &str, path: PathBuf, grammar: &mut Languages) -> Result<Self, ProjectError> {
        let error = |message: String| ProjectError {
            path: path.clone(),
            problems: vec![message],
        };
        let value = jsonc_parser::parse_to_serde_value(text, &Default::default())
            .map_err(|failure| error(failure.to_string()))?
            .ok_or_else(|| error("uffda.jsonc must hold an object".into()))?;
        let fields = value
            .as_object()
            .ok_or_else(|| error("uffda.jsonc must hold an object".into()))?;
        let mut problems = Vec::new();
        for field in fields.keys() {
            if !["imports", "exports", "languages", "outDir"].contains(&field.as_str()) {
                problems.push(format!("Unknown field `{field}`"));
            }
        }
        let mut classify = |text: &str| -> Result<Option<&'static str>, ProjectError> {
            match grammar.module_specifier(text) {
                Ok(Value::String(parsed)) if parsed == text => {
                    Ok(Some(if text.starts_with("jsr:") {
                        "jsr"
                    } else if text.starts_with('@') {
                        "name"
                    } else {
                        "relative"
                    }))
                }
                Ok(_) => Err(error(
                    "Module specifier grammar returned an invalid result".into(),
                )),
                Err(failure) if failure.phase == "match" => Ok(None),
                Err(failure) => Err(error(failure.to_string())),
            }
        };
        let mut imports = BTreeMap::new();
        if let Some(value) = fields.get("imports") {
            if let Some(entries) = value.as_object() {
                for (name, target) in entries {
                    if classify(name)? != Some("name") {
                        problems.push(format!(
                            "`imports` key {name:?} must be a module name starting with @"
                        ));
                        continue;
                    }
                    let valid = match target.as_str() {
                        Some(target) => classify(target)? == Some("jsr"),
                        None => false,
                    };
                    if !valid {
                        problems.push(format!("`imports[{name:?}]` must be a jsr: specifier"));
                    } else {
                        imports.insert(name.clone(), target.as_str().unwrap().to_owned());
                    }
                }
            } else {
                problems.push("`imports` must be an object of module names".into());
            }
        }
        for alias in imports.keys() {
            for other in imports.keys() {
                if alias != other && under_alias(other, alias) {
                    problems.push(format!("`imports` {alias:?} overlaps {other:?}"));
                }
            }
        }
        let mut project_path = |text: &str| -> Result<bool, ProjectError> {
            Ok(text.starts_with("./") && classify(text)? == Some("relative"))
        };
        let mut exports = BTreeMap::new();
        if let Some(value) = fields.get("exports") {
            if let Some(entries) = value.as_object() {
                for (name, target) in entries {
                    if name != "." && !project_path(name)? {
                        problems.push(format!("`exports` key {name:?} must be . or start with ./"));
                        continue;
                    }
                    let valid = match target.as_str() {
                        Some(target) => project_path(target)?,
                        None => false,
                    };
                    if valid {
                        exports.insert(name.clone(), target.as_str().unwrap().to_owned());
                    } else {
                        problems.push(format!(
                            "`exports[{name:?}]` must be a path inside the project starting with ./"
                        ));
                    }
                }
            } else {
                problems.push("`exports` must be an object of export names".into());
            }
        }
        let root = path
            .parent()
            .ok_or_else(|| error("Project file has no parent directory".into()))?
            .to_path_buf();
        let out_dir = match fields.get("outDir") {
            None => root.join("bin"),
            Some(value) => match value.as_str() {
                Some(text) if project_path(text)? => root.join(text),
                _ => {
                    problems.push(
                        "`outDir` must be a directory inside the project starting with ./".into(),
                    );
                    root.join("bin")
                }
            },
        };
        let mut languages = Vec::new();
        if let Some(value) = fields.get("languages") {
            if let Some(entries) = value.as_array() {
                for (index, value) in entries.iter().enumerate() {
                    let Some(text) = value.as_str() else {
                        problems.push(format!("`languages[{index}]` must be a module specifier"));
                        continue;
                    };
                    match classify(text)? {
                        None => problems
                            .push(format!("`languages[{index}]` must be a module specifier")),
                        Some("name") if !imports.keys().any(|alias| under_alias(text, alias)) => {
                            problems.push(format!("`languages[{index}]` names {text:?}, which imports does not declare"));
                        }
                        Some(_) if languages.iter().any(|entry| entry == text) => {
                            problems.push(format!("`languages[{index}]` repeats {text:?}"));
                        }
                        Some(_) => languages.push(text.to_owned()),
                    }
                }
            } else {
                problems.push("`languages` must be an array of module specifiers".into());
            }
        }
        if !problems.is_empty() {
            return Err(ProjectError { path, problems });
        }
        Ok(Self {
            path,
            root,
            imports,
            exports,
            languages,
            out_dir,
        })
    }

    pub fn resolver(&self) -> Result<Resolver, ProjectError> {
        let error = |message: String| ProjectError {
            path: self.path.clone(),
            problems: vec![message],
        };
        let mut resolver = Resolver::new(self.root.clone(), self.out_dir.clone())
            .map_err(|failure| error(failure.to_string()))?;
        resolver
            .set_import_map(self.imports.clone())
            .map_err(|failure| error(failure.to_string()))?;
        let lockfile = Lockfile::load(self.root.join("uffda.lock")).map_err(error)?;
        resolver.set_packages(JsrPackages::standard(lockfile).map_err(error)?);
        Ok(resolver)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:project-file-001
    fn jsonc_optional_fields_and_grammar_validated_specifiers() {
        let mut grammar = Languages::new().unwrap();
        let path = std::env::current_dir().unwrap().join("uffda.jsonc");
        let project = Project::parse(
            r#"{
            // Package aliases
            "imports":{"@acme/kv":"jsr:@acme/kv@^1.2.0"},
            "exports":{".":"./src/kv.uff"},
            "languages":["@acme/kv/lang","./src/lang/foo.uff"],
            "outDir":"./build"
        }"#,
            path,
            &mut grammar,
        )
        .unwrap();
        assert_eq!(project.imports["@acme/kv"], "jsr:@acme/kv@^1.2.0");
        assert_eq!(project.exports["."], "./src/kv.uff");
        assert_eq!(project.languages.len(), 2);
        assert_eq!(project.out_dir, project.root.join("./build"));
    }

    #[test]
    // req:project-file-001 req:project-file-002
    fn invalid_project_reports_independent_problems_and_alias_collisions() {
        let mut grammar = Languages::new().unwrap();
        let path = std::env::current_dir().unwrap().join("uffda.jsonc");
        let error = Project::parse(
            r#"{
            "unknown":true, "imports":{"@acme":"jsr:@acme/kv","@acme/kv":"jsr:@acme/kv"},
            "exports":[], "languages":["@missing/pkg",42,"./x.uff","./x.uff"],"outDir":42
        }"#,
            path,
            &mut grammar,
        )
        .err()
        .unwrap();
        assert_eq!(error.problems.len(), 7);
    }

    #[test]
    // req:project-file-001
    fn explicit_config_requires_a_file_and_absent_project_is_valid() {
        let base = std::env::temp_dir().join(format!("uffda-project-{}", std::process::id()));
        std::fs::create_dir_all(base.join("uffda.jsonc")).unwrap();
        assert!(Project::discover(&base, Some("missing.json")).is_err());
        assert!(Project::discover(&base, Some("uffda.jsonc")).is_err());
        assert!(Project::discover(&base, None).unwrap().is_none());
        std::fs::remove_dir(base.join("uffda.jsonc")).unwrap();
        std::fs::remove_dir(base).unwrap();
    }
}

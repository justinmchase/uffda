use serde::Serialize;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourcePathFailure {
    pub source_path: String,
    pub message: String,
    pub not_found: bool,
}

pub struct ExpandedPaths {
    pub files: BTreeSet<PathBuf>,
    pub explicit: BTreeSet<PathBuf>,
    pub failures: Vec<SourcePathFailure>,
}

pub fn stable_path(cwd: &Path, path: &Path) -> String {
    let path = pathdiff::diff_paths(path, cwd).unwrap_or_else(|| path.to_path_buf());
    if path.as_os_str().is_empty() {
        ".".into()
    } else {
        path.to_string_lossy().replace('\\', "/")
    }
}

pub fn expand(cwd: &Path, patterns: &[String], excludes: &[&str]) -> ExpandedPaths {
    let mut result = ExpandedPaths {
        files: BTreeSet::new(),
        explicit: BTreeSet::new(),
        failures: vec![],
    };
    for pattern in patterns {
        let fail = |message, not_found| SourcePathFailure {
            source_path: pattern.clone(),
            message,
            not_found,
        };
        if !pattern.contains(['*', '?', '[', '{']) {
            let path = match crate::resolver::normalize_path(&cwd.join(pattern)) {
                Ok(path) => path,
                Err(error) => {
                    result.failures.push(fail(error.to_string(), false));
                    continue;
                }
            };
            match path.metadata() {
                Ok(metadata) if metadata.is_file() => {
                    result.explicit.insert(path.clone());
                    result.files.insert(path);
                }
                Ok(metadata) if metadata.is_dir() => result.failures.push(fail(
                    format!("Directories are not supported as inputs; use a glob pattern: {pattern}/**/*.uff"), false)),
                Ok(_) => result.failures.push(fail(format!("Source path is not a file: {}", path.display()), false)),
                Err(error) => result.failures.push(fail(format!("Unable to read source path {}: {error}", path.display()),
                    error.kind() == std::io::ErrorKind::NotFound)),
            }
            continue;
        }
        let source = Path::new(pattern);
        let (root, pattern) = if source.is_absolute() {
            let root = source.ancestors().last().expect("absolute path has a root");
            (
                root,
                source
                    .strip_prefix(root)
                    .expect("root prefix")
                    .to_string_lossy()
                    .replace('\\', "/"),
            )
        } else {
            (cwd, pattern.replace('\\', "/"))
        };
        let mut patterns = vec![pattern];
        patterns.extend(excludes.iter().map(|exclude| format!("!{exclude}")));
        let walker = match globwalk::GlobWalkerBuilder::from_patterns(root, &patterns)
            .file_type(globwalk::FileType::FILE)
            .follow_links(true)
            .build()
        {
            Ok(walker) => walker,
            Err(error) => {
                result.failures.push(fail(error.to_string(), false));
                continue;
            }
        };
        let mut matched = false;
        for entry in walker {
            match entry {
                Ok(entry) => match crate::resolver::normalize_path(entry.path()) {
                    Ok(path) => {
                        matched = true;
                        result.files.insert(path);
                    }
                    Err(error) => result.failures.push(fail(error.to_string(), false)),
                },
                Err(error) => result.failures.push(fail(error.to_string(), false)),
            }
        }
        if !matched {
            result
                .failures
                .push(fail("Glob matched no files".into(), true));
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:project-file-003 req:cli-command-model-001
    fn expansion_deduplicates_files_supports_recursive_and_brace_globs_and_excludes() {
        let root = std::env::temp_dir().join(format!("uffda-paths-{}", std::process::id()));
        std::fs::create_dir_all(root.join("nested")).unwrap();
        std::fs::write(root.join("a.uff"), "").unwrap();
        std::fs::write(root.join("nested/b.uff"), "").unwrap();
        std::fs::write(root.join("nested/c.json"), "").unwrap();
        let expanded = expand(
            &root,
            &[
                "**/*.{uff,json}".into(),
                "a.uff".into(),
                "nested/../a.uff".into(),
            ],
            &["**/*.json"],
        );
        assert!(expanded.failures.is_empty(), "{:?}", expanded.failures);
        assert_eq!(expanded.files.len(), 2);
        assert_eq!(expanded.explicit.len(), 1);
        assert_eq!(
            stable_path(&root, &root.join("nested/b.uff")),
            "nested/b.uff"
        );
        let failed = expand(&root, &["absent*".into(), "nested".into()], &[]);
        assert_eq!(failed.failures.len(), 2);
        assert!(failed.failures[0].not_found);
        assert!(!failed.failures[1].not_found);
        for file in ["a.uff", "nested/b.uff", "nested/c.json"] {
            std::fs::remove_file(root.join(file)).unwrap();
        }
        std::fs::remove_dir(root.join("nested")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}

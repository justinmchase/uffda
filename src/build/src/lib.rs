//! Embed unmodified compiled ModuleDeclaration codec records into a Rust crate.
//!
//! The Rust build MUST NOT parse `.uff`, re-lower declarations, or mutate
//! artifact bytes. Consumers compile with a published `uffda` CLI first.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Inputs for generating an embedded `DECLARATIONS` module.
pub struct Embed {
    /// Directory tree of `*.uff.ast` files (unmodified compiler output).
    pub artifact_root: PathBuf,
    /// When set, every `.uff` under this tree must have a matching artifact and
    /// every artifact must correspond to an authored `.uff` (product bootstrap).
    pub authored_root: Option<PathBuf>,
    /// Logical path prefix without trailing slash, e.g. `src/lang` so
    /// `foo/bar.uff.ast` becomes `src/lang/foo/bar.uff`.
    pub logical_root: String,
    /// Destination file path (typically `OUT_DIR/languages.rs`).
    pub out_file: PathBuf,
}

#[derive(Debug)]
pub enum EmbedError {
    Io(io::Error),
    Message(String),
}

impl std::fmt::Display for EmbedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(f, "{error}"),
            Self::Message(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for EmbedError {}

impl From<io::Error> for EmbedError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

/// Walk `directory` for files whose names end with `suffix`, sorted.
pub fn files_with_suffix(directory: &Path, suffix: &str) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    let mut pending = vec![directory.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                pending.push(entry.path());
            } else if file_type.is_file() && entry.file_name().to_string_lossy().ends_with(suffix) {
                files.push(entry.path());
            }
        }
    }
    files.sort();
    Ok(files)
}

/// Validate the artifact tree and write `pub const DECLARATIONS: &[(&str, &str)]`.
pub fn embed(request: Embed) -> Result<(), EmbedError> {
    println!("cargo:rerun-if-changed={}", request.artifact_root.display());
    let files = files_with_suffix(&request.artifact_root, ".uff.ast").map_err(|error| {
        EmbedError::Message(format!(
            "Cannot embed compiled declarations from {}: {error}. Run a published uffda CLI to compile .uff sources first; never seed or rewrite artifacts.",
            request.artifact_root.display()
        ))
    })?;
    if files.is_empty() {
        return Err(EmbedError::Message(format!(
            "No compiled codec declaration artifacts found under {}. Install a published uffda CLI with .uff.ast emission and compile again; JSON is not an embedding fallback.",
            request.artifact_root.display()
        )));
    }

    if let Some(authored_root) = &request.authored_root {
        println!("cargo:rerun-if-changed={}", authored_root.display());
        let authored = files_with_suffix(authored_root, ".uff")?;
        for source in &authored {
            let relative = source.strip_prefix(authored_root).map_err(|_| {
                EmbedError::Message(format!(
                    "authored path {} escapes {}",
                    source.display(),
                    authored_root.display()
                ))
            })?;
            let mut expected = request.artifact_root.join(relative);
            expected.set_extension("uff.ast");
            if !files.contains(&expected) {
                return Err(EmbedError::Message(format!(
                    "Incomplete language artifacts: {} is missing. Finish a full published-compiler bootstrap before building.",
                    expected.display()
                )));
            }
        }
        if files.len() != authored.len() {
            return Err(EmbedError::Message(
                "Compiled artifact tree contains stale entries not present in authored sources; regenerate with a published uffda compiler".into(),
            ));
        }
    }

    let logical_root = request.logical_root.trim_end_matches('/');
    let mut source = String::from("pub const DECLARATIONS: &[(&str, &str)] = &[\n");
    for file in &files {
        let relative = file
            .strip_prefix(&request.artifact_root)
            .map_err(|_| {
                EmbedError::Message(format!(
                    "artifact {} escapes {}",
                    file.display(),
                    request.artifact_root.display()
                ))
            })?
            .to_str()
            .ok_or_else(|| EmbedError::Message("Non-UTF-8 grammar artifact path".into()))?
            .replace('\\', "/");
        let stem = relative
            .strip_suffix(".uff.ast")
            .ok_or_else(|| EmbedError::Message("Invalid grammar artifact extension".into()))?;
        let logical = if logical_root.is_empty() {
            format!("{stem}.uff")
        } else {
            format!("{logical_root}/{stem}.uff")
        };
        let absolute = file.canonicalize()?;
        source.push_str(&format!(
            "({logical:?}, include_str!({:?})),\n",
            absolute
                .to_str()
                .ok_or_else(|| EmbedError::Message("Non-UTF-8 artifact path".into()))?
        ));
    }
    source.push_str("];\n");
    if let Some(parent) = request.out_file.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&request.out_file, source)?;
    Ok(())
}

/// Write an empty `DECLARATIONS` table (library builds without product grammars).
pub fn write_empty(out_file: &Path) -> Result<(), EmbedError> {
    if let Some(parent) = out_file.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(out_file, "pub const DECLARATIONS: &[(&str, &str)] = &[];\n")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:data-codec-005
    fn embedding_requires_complete_codec_tree_and_preserves_bytes() {
        let root = std::env::temp_dir().join(format!("uffda-embed-codec-{}", std::process::id()));
        fs::create_dir(&root).unwrap();
        let artifacts = root.join("artifacts");
        let authored = root.join("authored");
        fs::create_dir(&artifacts).unwrap();
        fs::create_dir(&authored).unwrap();
        fs::write(authored.join("main.uff"), "fixture").unwrap();
        fs::write(artifacts.join("main.uff.ast.json"), "{}").unwrap();
        let request = || Embed {
            artifact_root: artifacts.clone(),
            authored_root: Some(authored.clone()),
            logical_root: "grammar".into(),
            out_file: root.join("languages.rs"),
        };
        let failure = embed(request()).unwrap_err().to_string();
        assert!(failure.contains("JSON is not an embedding fallback"));
        let record = "{imports:[] exports:[] rules:[]}\n";
        fs::write(artifacts.join("main.uff.ast"), record).unwrap();
        embed(request()).unwrap();
        let generated = fs::read_to_string(root.join("languages.rs")).unwrap();
        assert!(generated.contains("grammar/main.uff"));
        assert!(generated.contains("main.uff.ast\""));
        assert!(!generated.contains(".json"));
        assert_eq!(
            fs::read_to_string(artifacts.join("main.uff.ast")).unwrap(),
            record
        );
        fs::write(authored.join("missing.uff"), "fixture").unwrap();
        assert!(
            embed(request())
                .unwrap_err()
                .to_string()
                .contains("Incomplete")
        );
        fs::remove_file(authored.join("missing.uff")).unwrap();
        fs::write(artifacts.join("stale.uff.ast"), record).unwrap();
        assert!(embed(request()).unwrap_err().to_string().contains("stale"));
        fs::remove_dir_all(root).unwrap();
    }
}

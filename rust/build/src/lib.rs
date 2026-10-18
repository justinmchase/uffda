//! Embed unmodified compiled ModuleDeclaration JSON into a Rust crate.
//!
//! The Rust build MUST NOT parse `.uff`, re-lower declarations, or mutate
//! artifact bytes. Consumers compile with a published `uffda` CLI first.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Inputs for generating an embedded `DECLARATIONS` module.
pub struct Embed {
    /// Directory tree of `*.uffda.ast.json` files (unmodified compiler output).
    pub artifact_root: PathBuf,
    /// When set, every `.uff` under this tree must have a matching artifact and
    /// every artifact must correspond to an authored `.uff` (product bootstrap).
    pub authored_root: Option<PathBuf>,
    /// Logical path prefix without trailing slash, e.g. `src/lang` so
    /// `foo/bar.uffda.ast.json` becomes `src/lang/foo/bar.uff`.
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
    let files = files_with_suffix(&request.artifact_root, ".uffda.ast.json").map_err(|error| {
        EmbedError::Message(format!(
            "Cannot embed compiled declarations from {}: {error}. Run a published uffda CLI to compile .uff sources first; never seed or rewrite artifacts.",
            request.artifact_root.display()
        ))
    })?;
    if files.is_empty() {
        return Err(EmbedError::Message(format!(
            "No compiled declaration artifacts found under {}",
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
            expected.set_extension("uffda.ast.json");
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
            .strip_suffix(".uffda.ast.json")
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

use std::fs;
use std::path::{Path, PathBuf};

fn files_with_suffix(directory: &Path, suffix: &str) -> std::io::Result<Vec<PathBuf>> {
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR")?).join("../bin/ast/src/lang");
    println!("cargo:rerun-if-changed={}", root.display());
    let files = files_with_suffix(&root, ".uffda.ast.json").map_err(|error| {
        format!(
            "Cannot embed compiled languages from {}: {error}. Run the previous published uffda CLI to compile src/lang/**/*.uff first; never seed or rewrite artifacts.",
            root.display()
        )
    })?;
    if files.is_empty() {
        return Err("No compiled language artifacts found; bootstrap with the previous published uffda compiler".into());
    }
    let source_root = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR")?).join("../src/lang");
    println!("cargo:rerun-if-changed={}", source_root.display());
    let authored = files_with_suffix(&source_root, ".uff")?;
    for source in &authored {
        let relative = source.strip_prefix(&source_root)?;
        let mut expected = root.join(relative);
        expected.set_extension("uffda.ast.json");
        if !files.contains(&expected) {
            return Err(format!("Incomplete language artifacts: {} is missing. Finish the previous published compiler's full bootstrap before building; do not build during bin regeneration.", expected.display()).into());
        }
    }
    if files.len() != authored.len() {
        return Err("Compiled language tree contains stale artifacts not present in authored src/lang sources; regenerate with the previous published compiler".into());
    }
    let mut source = String::from("pub const DECLARATIONS: &[(&str, &str)] = &[\n");
    for file in files {
        let relative = file
            .strip_prefix(&root)?
            .to_str()
            .ok_or("Non-UTF-8 grammar artifact path")?
            .replace('\\', "/");
        let logical = format!(
            "src/lang/{}.uff",
            relative
                .strip_suffix(".uffda.ast.json")
                .ok_or("Invalid grammar artifact extension")?
        );
        let absolute = file.canonicalize()?;
        source.push_str(&format!(
            "({logical:?}, include_str!({:?})),\n",
            absolute.to_str().ok_or("Non-UTF-8 artifact path")?
        ));
    }
    source.push_str("];\n");
    fs::write(
        PathBuf::from(std::env::var("OUT_DIR")?).join("languages.rs"),
        source,
    )?;
    Ok(())
}

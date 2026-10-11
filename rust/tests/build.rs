use uffda_runtime::builtins::DECLARATIONS;

#[test]
// req:cli-bootstrap-015
fn build_script_embeds_the_published_artifact_tree() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../bin/ast/src/lang");
    let mut pending = vec![root.clone()];
    let mut files = Vec::new();
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let kind = entry.file_type().unwrap();
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".uffda.ast.json")
            {
                files.push(entry.path());
            }
        }
    }
    assert_eq!(files.len(), DECLARATIONS.len());
    for file in files {
        let relative = file
            .strip_prefix(&root)
            .unwrap()
            .to_str()
            .unwrap()
            .replace('\\', "/");
        let logical = format!(
            "src/lang/{}.uff",
            relative.strip_suffix(".uffda.ast.json").unwrap()
        );
        let embedded = DECLARATIONS
            .iter()
            .find(|(path, _)| *path == logical)
            .unwrap()
            .1;
        assert_eq!(embedded.as_bytes(), std::fs::read(file).unwrap());
    }
}

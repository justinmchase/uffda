use crate::languages::Languages;
use crate::project::Project;
use std::fs;
use std::path::PathBuf;

fn temp_tree(files: &[(&str, &str)]) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "uffda-project-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    for (path, text) in files {
        let full = root.join(path);
        if let Some(parent) = full.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(full, text).unwrap();
    }
    root
}

#[test]
// req:project-file-001
fn port_parse_project_empty_defaults_and_full_fields() {
    let mut grammar = Languages::new().unwrap();
    let path = PathBuf::from("/work/app/uffda.jsonc");
    let empty = Project::parse("{}", path.clone(), &mut grammar).unwrap();
    assert!(empty.imports.is_empty());
    assert!(empty.exports.is_empty());
    assert!(empty.languages.is_empty());
    assert_eq!(empty.out_dir, PathBuf::from("/work/app/bin"));

    let full = Project::parse(
        r#"{
            "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" },
            "exports": { ".": "./src/mod.uff", "./lang": "./src/kv.uff" },
            "languages": ["./src/foo.uff", "@acme/kv/lang", "jsr:@acme/json@^1/lang"],
            "outDir": "./build/out",
        }"#,
        path,
        &mut grammar,
    )
    .unwrap();
    assert_eq!(full.imports["@acme/kv"], "jsr:@acme/kv@^1.2.0");
    assert_eq!(full.exports["."], "./src/mod.uff");
    assert_eq!(full.exports["./lang"], "./src/kv.uff");
    assert_eq!(full.languages.len(), 3);
    assert_eq!(full.out_dir, PathBuf::from("/work/app/build/out"));
}

#[test]
// req:project-file-001
fn port_discover_nearest_project_file_and_skip_directory_named_like_file() {
    let root = temp_tree(&[
        ("uffda.jsonc", "{}"),
        ("app/uffda.jsonc", "{}"),
        ("app/src/deep/a.uff", ""),
        ("other/uffda.jsonc/x", ""),
    ]);
    assert_eq!(
        Project::discover(&root.join("app/src/deep"), None).unwrap(),
        Some(root.join("app/uffda.jsonc"))
    );
    assert_eq!(
        Project::discover(&root, None).unwrap(),
        Some(root.join("uffda.jsonc"))
    );
    assert_eq!(
        Project::discover(&root.join("other"), None).unwrap(),
        Some(root.join("uffda.jsonc"))
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
// req:project-file-001
fn port_load_valid_invalid_and_missing_project() {
    let mut grammar = Languages::new().unwrap();
    let valid = temp_tree(&[
        ("uffda.jsonc", r#"{ "languages": ["./a.uff"] }"#),
        ("src/x", ""),
    ]);
    let path = Project::discover(&valid.join("src"), None)
        .unwrap()
        .unwrap();
    let project = Project::load(path, &mut grammar).unwrap();
    assert_eq!(project.root, valid);
    assert_eq!(project.languages, vec!["./a.uff".to_string()]);
    let _ = fs::remove_dir_all(valid);

    let invalid = temp_tree(&[("uffda.jsonc", r#"{ "languages": 1 }"#)]);
    let path = Project::discover(&invalid, None).unwrap().unwrap();
    assert!(Project::load(path.clone(), &mut grammar).is_err());
    assert_eq!(path, invalid.join("uffda.jsonc"));
    let _ = fs::remove_dir_all(invalid);

    let missing = temp_tree(&[]);
    assert_eq!(Project::discover(&missing, None).unwrap(), None);
    let _ = fs::remove_dir_all(missing);
}

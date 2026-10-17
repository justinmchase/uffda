#![allow(unused_imports)]
use super::*;
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::atomic::{AtomicU64, Ordering};
use url::Url;

const DECLARATION: &str = r#"{"imports":[],"exports":[],"rules":[]}"#;

const DIGIT: &str = r#"{"imports":[],"exports":[{"kind":"rule","name":"Digit"}],"rules":[{"name":"Digit","parameters":[],"pattern":{"kind":"any"}}]}"#;

fn repo_root() -> PathBuf {
    super::normalize_path(&Path::new(env!("CARGO_MANIFEST_DIR")).join("..")).unwrap()
}

struct Directory(PathBuf);

impl Directory {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "uffda-resolver-port-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn url(&self, name: &str) -> Url {
        Url::from_file_path(self.0.join(name)).unwrap()
    }

    fn resolver(&self) -> Resolver {
        Resolver::new(self.0.clone(), self.0.join("bin")).unwrap()
    }
}

impl Drop for Directory {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}

#[derive(Default)]
struct RecordingTransport {
    files: RefCell<BTreeMap<String, Vec<u8>>>,
    requests: RefCell<Vec<String>>,
}

impl packages::Transport for RecordingTransport {
    fn read(&self, url: &Url) -> Result<Vec<u8>, String> {
        self.requests.borrow_mut().push(url.as_str().to_owned());
        self.files
            .borrow()
            .get(url.as_str())
            .cloned()
            .ok_or_else(|| format!("failed with 404 {url}"))
    }
}

fn write_artifact(root: &Path, relative_uff: &str, body: &str) {
    let mut artifact = root.join("ast").join(relative_uff);
    artifact.set_extension("uffda.ast.json");
    std::fs::create_dir_all(artifact.parent().unwrap()).unwrap();
    std::fs::write(artifact, body).unwrap();
}

fn export_named(declaration: &ModuleDeclaration, name: &str) -> bool {
    declaration
        .exports
        .iter()
        .any(|export| export.get("name").and_then(|value| value.as_str()) == Some(name))
}

#[test]
// req:project-file-003
fn artifact_path_ported_maps_source_paths_like_compile_emission() {
    let root = PathBuf::from("/repo");
    let resolver = Resolver::new(root.clone(), root.join("bin")).unwrap();
    let source = root.join("src/lang/common/characters/digit.uff");
    assert_eq!(
        resolver
            .load_path(&Url::from_file_path(&source).unwrap())
            .unwrap(),
        root.join("bin/ast/src/lang/common/characters/digit.uffda.ast.json")
    );
}

#[test]
// req:project-file-003
fn artifact_path_ported_places_artifacts_under_custom_out_dir() {
    let root = PathBuf::from("/repo");
    let resolver = Resolver::new(root.clone(), root.join("build")).unwrap();
    let source = root.join("nested/mod.uff");
    assert_eq!(
        resolver
            .load_path(&Url::from_file_path(&source).unwrap())
            .unwrap(),
        root.join("build/ast/nested/mod.uffda.ast.json")
    );
}

#[test]
// req:project-file-003 req:cli-bootstrap-004
fn artifact_path_ported_gives_no_artifact_outside_the_root() {
    let root = PathBuf::from("/repo/project");
    let resolver = Resolver::new(root.clone(), root.join("bin")).unwrap();
    let outside = resolver
        .load_path(&Url::from_file_path("/repo/other/mod.uff").unwrap())
        .unwrap_err();
    assert!(outside.message.contains("outside artifact root"));
    assert!(outside.message.contains(&root.display().to_string()));
    let root_itself = resolver
        .load_path(&Url::from_file_path(&root).unwrap())
        .unwrap_err();
    assert!(root_itself.message.contains("unknown extension"));
    assert_eq!(
        resolver
            .load_path(&Url::from_file_path(root.join("..x/mod.uff")).unwrap())
            .unwrap(),
        root.join("bin/ast/..x/mod.uffda.ast.json")
    );
}

#[test]
// req:project-file-003
fn artifact_path_ported_maps_package_module_urls() {
    let transport = Rc::new(RecordingTransport::default());
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport.clone());
    let https_root = Url::parse("https://jsr.io/@justinmchase/uffda/0.9.1/").unwrap();
    resolver
        .add_artifact_package(https_root.clone(), "./bin")
        .unwrap();
    let https_module = https_root
        .join("src/lang/uffda/specifier.rules.uff")
        .unwrap();
    let expected = "https://jsr.io/@justinmchase/uffda/0.9.1/bin/ast/src/lang/uffda/specifier.rules.uffda.ast.json";
    assert!(resolver.load_declaration(&https_module).is_err());
    assert_eq!(
        transport.requests.borrow().as_slice(),
        [expected.to_owned()].as_slice()
    );

    let dir = Directory::new();
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    let file_root = Url::from_directory_path(&dir.0).unwrap();
    resolver
        .add_artifact_package(file_root.clone(), "./bin")
        .unwrap();
    let module = file_root.join("src/lang/uffda/mod.uff").unwrap();
    write_artifact(&dir.0.join("bin"), "src/lang/uffda/mod.uff", DECLARATION);
    std::fs::create_dir_all(dir.0.join("src/lang/uffda")).unwrap();
    std::fs::write(dir.0.join("src/lang/uffda/mod.uff"), "not json").unwrap();
    assert!(resolver.load_declaration(&module).unwrap().rules.is_empty());
}

#[test]
// req:project-file-003
fn artifact_path_ported_honors_package_out_dir() {
    let transport = Rc::new(RecordingTransport::default());
    let root = Url::parse("https://example.test/pkg/1.0.0/").unwrap();
    let module = root.join("src/app.uff").unwrap();
    let expected = "https://example.test/pkg/1.0.0/build/ast/src/app.uffda.ast.json";
    transport
        .files
        .borrow_mut()
        .insert(expected.to_owned(), DECLARATION.into());
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport.clone());
    resolver.add_artifact_package(root, "./build").unwrap();
    assert!(resolver.load_declaration(&module).unwrap().rules.is_empty());
    assert_eq!(
        transport.requests.borrow().as_slice(),
        [expected.to_owned()].as_slice()
    );
}

#[test]
// req:project-file-003
fn artifact_path_ported_gives_no_artifact_outside_package_root() {
    let transport = Rc::new(RecordingTransport::default());
    let root = Url::parse("https://example.test/pkg/1.0.0/").unwrap();
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport.clone());
    resolver
        .add_artifact_package(root.clone(), "./bin")
        .unwrap();
    assert!(
        resolver
            .load_declaration(&Url::parse("https://example.test/other/app.uff").unwrap())
            .is_err()
    );
    assert!(resolver.load_declaration(&root).is_err());
    assert!(transport.requests.borrow().is_empty());
}

#[test]
// req:project-file-002
fn import_map_ported_unfurls_aliases_by_segment() {
    let imports = BTreeMap::from([
        ("@acme/kv".to_owned(), "jsr:@acme/kv@^1.2.0".to_owned()),
        ("@tok".to_owned(), "jsr:@acme/tokens@^2/lang".to_owned()),
    ]);
    assert_eq!(
        super::graph::unfurl_specifier(&imports, "@acme/kv").unwrap(),
        "jsr:@acme/kv@^1.2.0"
    );
    assert_eq!(
        super::graph::unfurl_specifier(&imports, "@acme/kv/tokens").unwrap(),
        "jsr:@acme/kv@^1.2.0/tokens"
    );
    assert_eq!(
        super::graph::unfurl_specifier(&imports, "@acme/kv/lang").unwrap(),
        "jsr:@acme/kv@^1.2.0/lang"
    );
    assert_eq!(
        super::graph::unfurl_specifier(&imports, "@tok/words").unwrap(),
        "jsr:@acme/tokens@^2/lang/words"
    );
    assert!(super::graph::unfurl_specifier(&imports, "@acme/kvx").is_err());
    assert!(super::graph::unfurl_specifier(&imports, "@acme").is_err());
    for specifier in ["./a.uff", "../b/c.uff", "jsr:@x/y@^1/z"] {
        assert_eq!(
            super::graph::unfurl_specifier(&imports, specifier).unwrap(),
            specifier
        );
    }
    assert_eq!(
        super::graph::unfurl_specifier(&imports, "@acme/kvx").unwrap_err(),
        "@acme/kvx is not a module name the project file's imports declares"
    );
    assert_eq!(
        super::graph::unfurl_specifier(&BTreeMap::new(), "@acme/kv").unwrap_err(),
        "@acme/kv is not a module name the project file's imports declares"
    );
}

#[test]
// req:modules-runtime-001 req:modules-runtime-002
fn import_module_ported_loads_json_by_specifier() {
    let dir = Directory::new();
    std::fs::write(
        dir.0.join("test.module.json"),
        r#"{"kind":"module","imports":[],"exports":[],"rules":[{"name":"A","pattern":{"kind":"range","left":"0","right":"9"}}]}"#,
    )
    .unwrap();
    let declaration = dir
        .resolver()
        .load_declaration(&dir.url("test.module.json"))
        .unwrap();
    assert_eq!(declaration.rules[0]["name"], "A");
    assert!(declaration.imports.is_empty());
    assert!(declaration.exports.is_empty());
}

#[test]
// req:modules-runtime-001 req:modules-runtime-002
fn import_module_ported_network_json_and_http_failures() {
    let transport = Rc::new(RecordingTransport::default());
    let module = Url::parse("http://127.0.0.1/module.json").unwrap();
    transport
        .files
        .borrow_mut()
        .insert(module.as_str().to_owned(), DECLARATION.into());
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport);
    let loaded = resolver.load_declaration(&module).unwrap();
    assert!(loaded.imports.is_empty());
    assert!(loaded.exports.is_empty());
    assert!(loaded.rules.is_empty());
    let missing = Url::parse("http://127.0.0.1/missing.json").unwrap();
    let failure = resolver.load_declaration(&missing).unwrap_err();
    assert!(failure.message.contains("could not read JSON declaration"));
    assert!(failure.cause.unwrap().contains("404"));
    assert_eq!(resolver.declaration_count(), 1);
    let data = Url::parse("data:application/json,{}").unwrap();
    assert!(
        resolver
            .load_declaration(&data)
            .unwrap_err()
            .message
            .contains("unknown extension")
    );
}

#[test]
// req:modules-runtime-001
fn import_module_ported_rejects_unknown_extensions_before_reading() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    for extension in [".ts", ".js", ".mjs", ".txt"] {
        let name = format!("not-read{extension}");
        std::fs::write(dir.0.join(&name), "do not read").unwrap();
        let failure = resolver.load_declaration(&dir.url(&name)).unwrap_err();
        assert!(
            failure
                .message
                .contains(&format!("unknown extension {extension}")),
            "{}",
            failure.message
        );
        assert!(failure.cause.is_none());
    }
    assert_eq!(resolver.declaration_count(), 0);
}

#[test]
// req:modules-runtime-002
fn json_resolver_ported_validates_declarations_and_parse_failures() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    let url = dir.url("module.json");
    for text in [
        "null",
        "42",
        "{}",
        r#"{"imports":[],"exports":[],"rules":[],"funcs":null}"#,
    ] {
        std::fs::write(dir.0.join("module.json"), text).unwrap();
        let failure = resolver.load_declaration(&url).unwrap_err();
        assert!(
            failure
                .message
                .contains("declaration must be a ModuleDeclaration"),
            "{text}: {}",
            failure.message
        );
        assert!(failure.cause.is_some());
        assert_eq!(resolver.declaration_count(), 0);
    }
    std::fs::write(dir.0.join("module.json"), DECLARATION).unwrap();
    assert!(resolver.load_declaration(&url).unwrap().rules.is_empty());
    assert_eq!(resolver.declaration_count(), 1);
    std::fs::write(dir.0.join("module.json"), "{ malformed").unwrap();
    let mut reread = dir.resolver();
    let invalid = reread.load_declaration(&url).unwrap_err();
    assert!(invalid.message.contains("invalid declaration JSON"));
    assert!(invalid.cause.is_some());
    assert_eq!(reread.declaration_count(), 0);
}

#[test]
// req:modules-runtime-005
fn import_chain_ported_prepends_frames_root_first() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    assert!(
        resolver
            .load_declaration(&dir.url("missing.json"))
            .unwrap_err()
            .import_chain
            .is_empty()
    );
    let main = dir.url("a.json");
    let middle = dir.url("b.json");
    let leaf = dir.url("c.json");
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            r#"{"imports":[{"kind":"module","moduleUrl":"./b.json","names":["R"]}],"exports":[],"rules":[]}"#,
        )
        .unwrap(),
    );
    resolver.insert_declaration(
        middle.clone(),
        decode_declaration(
            &middle,
            r#"{"imports":[{"kind":"module","moduleUrl":"./c.json","names":["R"]}],"exports":[],"rules":[]}"#,
        )
        .unwrap(),
    );
    let failure = match resolver.load_graph(&main) {
        Ok(_) => panic!("expected missing module"),
        Err(error) => error,
    };
    assert_eq!(failure.import_chain.len(), 2);
    assert_eq!(failure.import_chain[0].importer_url, main.as_str());
    assert_eq!(failure.import_chain[0].import_index, 0);
    assert_eq!(failure.import_chain[0].module_url, "./b.json");
    assert_eq!(
        failure.import_chain[0].resolved_url.as_deref(),
        Some(middle.as_str())
    );
    assert_eq!(failure.import_chain[1].importer_url, middle.as_str());
    assert_eq!(failure.import_chain[1].import_index, 0);
    assert_eq!(failure.import_chain[1].module_url, "./c.json");
    assert_eq!(
        failure.import_chain[1].resolved_url.as_deref(),
        Some(leaf.as_str())
    );
}

#[test]
// req:cli-bootstrap-004 req:project-file-003 req:modules-runtime-001
fn uff_artifact_ported_loads_mirrored_bin_exports() {
    let repo = repo_root();
    let out = Directory::new();
    let mut resolver = Resolver::new(repo.clone(), out.0.clone()).unwrap();
    let relative = "src/lang/common/characters/digit.uff";
    write_artifact(&out.0, relative, DIGIT);
    let module = Url::from_file_path(repo.join(relative)).unwrap();
    let graph = resolver.load_graph(&module).unwrap();
    assert_eq!(graph.entry, module);
    assert!(graph.modules[&module].exports.contains_key("Digit"));
}

#[test]
// req:cli-bootstrap-004
fn uff_artifact_ported_missing_artifact_names_the_path() {
    let repo = repo_root();
    let out = Directory::new();
    let mut resolver = Resolver::new(repo.clone(), out.0.clone()).unwrap();
    let relative = "src/lang/common/characters/digit.uff";
    let module = Url::from_file_path(repo.join(relative)).unwrap();
    let failure = resolver.load_declaration(&module).unwrap_err();
    let mut expected = out.0.join("ast").join(relative);
    expected.set_extension("uffda.ast.json");
    assert!(
        failure.message.contains(&expected.display().to_string()),
        "{}",
        failure.message
    );
    assert!(failure.cause.is_some());
    assert_eq!(failure.module_url, module.as_str());
}

#[test]
// req:cli-bootstrap-004 req:project-file-003
fn uff_artifact_ported_rejects_module_outside_layout_root() {
    let root = Directory::new();
    let mut resolver = root.resolver();
    let module =
        Url::from_file_path(repo_root().join("src/lang/common/characters/digit.uff")).unwrap();
    let failure = resolver.load_declaration(&module).unwrap_err();
    assert!(
        failure.message.contains("outside artifact root"),
        "{}",
        failure.message
    );
    assert!(failure.message.contains(&root.0.display().to_string()));
    assert_eq!(failure.module_url, module.as_str());
}

#[test]
// req:cli-bootstrap-004 req:modules-runtime-001
fn uff_artifact_ported_resolves_nested_imports_from_artifacts() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    write_artifact(
        &dir.0.join("bin"),
        "leaf.uff",
        r#"{"imports":[],"exports":[{"kind":"rule","name":"Leaf"}],"rules":[{"name":"Leaf","parameters":[],"pattern":{"kind":"any"}}]}"#,
    );
    write_artifact(
        &dir.0.join("bin"),
        "root.uff",
        r#"{"imports":[{"kind":"module","moduleUrl":"./leaf.uff","names":["Leaf"]}],"exports":[{"kind":"rule","name":"Root"}],"rules":[{"name":"Root","parameters":[],"pattern":{"kind":"any"}}]}"#,
    );
    std::fs::write(dir.0.join("leaf.uff"), "not json").unwrap();
    std::fs::write(dir.0.join("root.uff"), "not json").unwrap();
    let root = dir.url("root.uff");
    let graph = resolver.load_graph(&root).unwrap();
    assert_eq!(
        graph.modules[&root]
            .exports
            .keys()
            .cloned()
            .collect::<Vec<_>>(),
        vec!["Root".to_owned()]
    );
    assert!(graph.modules[&root].imports.contains_key("Leaf"));
    assert_eq!(
        graph.modules[&root].imports["Leaf"].module_url,
        dir.url("leaf.uff")
    );
}

#[test]
// req:cli-bootstrap-004 req:project-file-003
fn uff_artifact_ported_loads_file_package_root() {
    let repo = repo_root();
    let mut resolver = Resolver::new(repo.clone(), repo.join("bin")).unwrap();
    let module = Url::from_file_path(repo.join("src/lang/common/characters/digit.uff")).unwrap();
    let declaration = resolver.load_declaration(&module).unwrap();
    assert!(export_named(&declaration, "Digit"));
    assert_eq!(resolver.load_graph(&module).unwrap().entry, module);
}

#[test]
// req:cli-distribution-006
fn uff_artifact_ported_loads_https_package_root() {
    let package_root = Url::parse("https://jsr.io/@justinmchase/uffda/0.9.1/").unwrap();
    let module = package_root
        .join("src/lang/common/characters/digit.uff")
        .unwrap();
    let expected = package_root
        .join("bin/ast/src/lang/common/characters/digit.uffda.ast.json")
        .unwrap();
    assert_eq!(
        expected.as_str(),
        "https://jsr.io/@justinmchase/uffda/0.9.1/bin/ast/src/lang/common/characters/digit.uffda.ast.json"
    );
    let transport = Rc::new(RecordingTransport::default());
    transport.files.borrow_mut().insert(
        expected.as_str().to_owned(),
        std::fs::read(repo_root().join("bin/ast/src/lang/common/characters/digit.uffda.ast.json"))
            .unwrap(),
    );
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport.clone());
    resolver
        .add_artifact_package(package_root, "./bin")
        .unwrap();
    let declaration = resolver.load_declaration(&module).unwrap();
    assert!(export_named(&declaration, "Digit"));
    assert_eq!(
        transport.requests.borrow().as_slice(),
        [expected.as_str().to_owned()].as_slice()
    );
}

#[test]
// req:project-file-003
fn uff_artifact_ported_rejects_module_outside_package_root() {
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver
        .add_artifact_package(
            Url::parse("https://jsr.io/@justinmchase/uffda/0.9.1/").unwrap(),
            "./bin",
        )
        .unwrap();
    let module = Url::parse("https://example.test/other/mod.uff").unwrap();
    let failure = resolver.load_declaration(&module).unwrap_err();
    assert_eq!(failure.module_url, module.as_str());
    assert!(
        failure
            .message
            .contains("remote .uff module needs a package artifact layout"),
        "{}",
        failure.message
    );
}

#[test]
// req:project-file-003 req:cli-distribution-006
fn uff_artifact_ported_honors_package_out_dir() {
    let package_root = Url::parse("https://example.test/@acme/dsl/1.0.0/").unwrap();
    let module = package_root.join("src/grammar.uff").unwrap();
    let expected = package_root
        .join("build/ast/src/grammar.uffda.ast.json")
        .unwrap();
    let transport = Rc::new(RecordingTransport::default());
    transport
        .files
        .borrow_mut()
        .insert(expected.as_str().to_owned(), DECLARATION.into());
    let mut resolver = Resolver::new(PathBuf::from("/tmp"), PathBuf::from("/tmp/bin")).unwrap();
    resolver.set_transport(transport.clone());
    resolver
        .add_artifact_package(package_root, "./build")
        .unwrap();
    assert!(resolver.load_declaration(&module).is_ok());
    assert_eq!(
        transport.requests.borrow().as_slice(),
        [expected.as_str().to_owned()].as_slice()
    );
}

use super::*;
use serde_json::json;
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::{AtomicU64, Ordering};
use url::Url;

struct Directory(PathBuf);

impl Directory {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "uffda-packages-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }
}

impl Drop for Directory {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}

#[derive(Default)]
struct FakeTransport {
    files: RefCell<BTreeMap<String, Vec<u8>>>,
    requests: RefCell<Vec<String>>,
}

impl Transport for FakeTransport {
    fn read(&self, url: &Url) -> Result<Vec<u8>, String> {
        self.requests.borrow_mut().push(url.path().into());
        self.files
            .borrow()
            .get(url.path())
            .cloned()
            .ok_or_else(|| format!("{url} was not found"))
    }
}

fn declaration(name: &str) -> String {
    json!({"imports":[],"exports":[{"kind":"rule","name":name}],"rules":[{"name":name,"parameters":[],"pattern":{"kind":"any"}}]}).to_string()
}

fn version(fake: &FakeTransport, version: &str, project: &str, extra: &[(&str, String)]) {
    let mut files = BTreeMap::from([("uffda.jsonc".to_string(), project.to_string())]);
    files.extend(
        extra
            .iter()
            .map(|(path, value)| (path.to_string(), value.clone())),
    );
    let mut manifest = BTreeMap::new();
    for (path, text) in files {
        manifest.insert(
            format!("/{path}"),
            json!({"checksum":format!("sha256-{}", sha256(text.as_bytes()))}),
        );
        fake.files
            .borrow_mut()
            .insert(format!("/@acme/kv/{version}/{path}"), text.into_bytes());
    }
    fake.files.borrow_mut().insert(
        format!("/@acme/kv/{version}_meta.json"),
        json!({"manifest":manifest}).to_string().into_bytes(),
    );
}

fn setup(dir: &Directory, fake: Rc<FakeTransport>, lockfile: Lockfile) -> JsrPackages {
    JsrPackages::new(
        Url::parse("https://registry.test/").unwrap(),
        dir.0.clone(),
        fake,
        lockfile,
    )
    .unwrap()
}

#[test]
// req:modules-runtime-006
fn shared_semver_range_corpus_matches_reference() {
    #[derive(Deserialize)]
    struct Fixture {
        range: String,
        versions: Vec<String>,
        #[serde(default)]
        invalid: bool,
        expected: Option<String>,
    }
    let fixtures: Vec<Fixture> =
        serde_json::from_str(include_str!("../../../../test/rust/semver-fixtures.json")).unwrap();
    for fixture in fixtures {
        let actual =
            highest_satisfying(fixture.versions.iter().map(String::as_str), &fixture.range);
        if fixture.invalid {
            assert!(actual.is_err(), "range {}", fixture.range);
            continue;
        }
        assert_eq!(actual.unwrap(), fixture.expected, "range {}", fixture.range);
    }
    assert!(highest_satisfying(["1.0.0"].into_iter(), "not a range").is_err());
    assert!(highest_satisfying(["1.0.0"].into_iter(), "latest").is_err());
}

#[test]
// req:modules-runtime-006 req:modules-runtime-001 req:modules-runtime-002 req:cli-bootstrap-004
fn resolves_exports_and_loads_uff_artifacts_and_direct_json_without_source_access() {
    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.2.0":{},"1.3.0":{},"1.4.0":{"yanked":true},"2.0.0":{}}})
            .to_string()
            .into_bytes(),
    );
    for ver in ["1.2.0", "1.3.0", "2.0.0"] {
        version(
            &fake,
            ver,
            r#"{
          // published output layout
          "exports": {".":"./src/module.uff","./json":"./data.json",},
          "outDir":"./out",
        }"#,
            &[
                ("out/ast/src/module.uffda.ast.json", declaration("UFF")),
                ("data.json", declaration("JSON")),
                ("invalid.json", "{}".into()),
            ],
        );
    }
    let mut packages = setup(&dir, fake.clone(), Lockfile::memory());
    let uff = packages.resolve("jsr:@acme/kv@^1.2.0").unwrap();
    assert_eq!(
        uff.as_str(),
        "https://registry.test/@acme/kv/1.3.0/src/module.uff"
    );
    assert_eq!(packages.load(&uff).unwrap().rules[0]["name"], "UFF");
    let json = packages.resolve("jsr:@acme/kv@^1.2.0/json").unwrap();
    assert_eq!(packages.load(&json).unwrap().rules[0]["name"], "JSON");
    assert!(
        !fake
            .requests
            .borrow()
            .iter()
            .any(|path| path.ends_with("src/module.uff"))
    );
    let invalid = Url::parse("https://registry.test/@acme/kv/1.3.0/invalid.json").unwrap();
    assert!(
        packages
            .load(&invalid)
            .unwrap_err()
            .message
            .contains("ModuleDeclaration")
    );
    let executable = Url::parse("https://registry.test/@acme/kv/1.3.0/mod.ts").unwrap();
    assert!(
        packages
            .load(&executable)
            .unwrap_err()
            .message
            .contains("modules only")
    );
    assert!(
        !fake
            .requests
            .borrow()
            .iter()
            .any(|path| path.ends_with("mod.ts"))
    );
    assert_eq!(
        packages.lockfile.data.specifiers["jsr:@acme/kv@^1.2.0"],
        "1.3.0"
    );
}

#[test]
// req:modules-runtime-006
fn cache_rechecks_checksums_and_lockfile_pins_metadata_even_offline() {
    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
    );
    version(
        &fake,
        "1.0.0",
        r#"{"exports":{".":"./module.json"}}"#,
        &[("module.json", declaration("A"))],
    );
    let lock_path = dir.0.join("uffda.lock");
    let mut packages = setup(
        &dir,
        fake.clone(),
        Lockfile::load(lock_path.clone()).unwrap(),
    );
    let url = packages.resolve("jsr:@acme/kv@1.0.0").unwrap();
    packages.load(&url).unwrap();
    std::fs::write(dir.0.join("jsr/@acme/kv/1.0.0/module.json"), "tampered").unwrap();
    let mut again = setup(
        &dir,
        fake.clone(),
        Lockfile::load(lock_path.clone()).unwrap(),
    );
    assert_eq!(again.load(&url).unwrap().rules[0]["name"], "A");
    fake.files.borrow_mut().clear();
    let mut offline = setup(&dir, fake.clone(), Lockfile::load(lock_path).unwrap());
    let same = offline.resolve("jsr:@acme/kv@1.0.0").unwrap();
    assert_eq!(same, url);
    assert_eq!(offline.load(&same).unwrap().rules[0]["name"], "A");
    let count = fake.requests.borrow().len();
    assert_eq!(offline.resolve("jsr:@acme/kv@^1.0.0").unwrap(), url);
    assert_eq!(count + 1, fake.requests.borrow().len());
    assert_eq!(
        fake.requests.borrow().last().unwrap(),
        "/@acme/kv/meta.json"
    );
}

#[test]
// req:modules-runtime-006
fn tampered_downloads_and_locked_metadata_are_explicit_errors() {
    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
    );
    version(
        &fake,
        "1.0.0",
        r#"{"exports":{".":"./module.json"}}"#,
        &[("module.json", declaration("A"))],
    );
    fake.files.borrow_mut().insert(
        "/@acme/kv/1.0.0/module.json".into(),
        declaration("TAMPERED").into_bytes(),
    );
    let mut packages = setup(&dir, fake.clone(), Lockfile::memory());
    let url = packages.resolve("jsr:@acme/kv@1.0.0").unwrap();
    assert!(
        packages
            .load(&url)
            .unwrap_err()
            .message
            .contains("manifest checksum")
    );
    let mut lock = Lockfile::memory();
    lock.data.jsr.insert(
        "@acme/kv@1.0.0".into(),
        Integrity {
            integrity: "0".repeat(64),
        },
    );
    let mut locked = setup(&dir, fake, lock);
    assert!(
        locked
            .resolve("jsr:@acme/kv@1.0.0")
            .unwrap_err()
            .message
            .contains("lockfile integrity")
    );
}

#[test]
// req:modules-runtime-006 req:modules-runtime-001
fn invalid_specifiers_projects_exports_and_paths_fail_explicitly() {
    for specifier in [
        "jsr:acme/kv",
        "jsr:@acme/kv@",
        "jsr:@acme/kv/../escape",
        "jsr:@/kv",
        "jsr:@acme/",
    ] {
        assert!(parse_specifier(specifier).is_err(), "{specifier}");
    }
    for project in [
        r#"{"exports":{".":"./mod.ts"}}"#,
        r#"{"exports":{".":"./../escape.json"}}"#,
        r#"{"exports":{".":"./module.json"},"outDir":"../out"}"#,
        r#"{"exports":{".":"./module.json"},"outDir":"./"}"#,
        r#"{"exports":{".":"./module.json"},"outDir":"./foo/../bar"}"#,
        r#"{"exports":{".":"./foo/../module.json"}}"#,
        r#"{"exports":{".":42}}"#,
        r#"{"exports":[]}"#,
        r#"{"unknown":true}"#,
        r#"{"imports":[]}"#,
        r#"{"imports":{"@acme/kv":"file:///module.json"}}"#,
        r#"{"languages":"module"}"#,
        r#"{"languages":["@acme/missing"]}"#,
        r#"{"languages":["./a.uff","./a.uff"]}"#,
        r#"{"languages":["./"]}"#,
        r#"{"languages":["./foo/../bar.uff"]}"#,
        r#"{"languages":[42]}"#,
        "null",
    ] {
        let dir = Directory::new();
        let fake = Rc::new(FakeTransport::default());
        fake.files.borrow_mut().insert(
            "/@acme/kv/meta.json".into(),
            json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
        );
        version(&fake, "1.0.0", project, &[]);
        assert!(
            setup(&dir, fake, Lockfile::memory())
                .resolve("jsr:@acme/kv@1.0.0")
                .is_err(),
            "{project}"
        );
    }
    for path in [
        "../escape",
        "/absolute",
        "foo\\bar",
        "foo//bar",
        "foo/%2e%2e/bar",
    ] {
        assert!(safe_path(path).is_err(), "{path}");
    }
}

#[test]
// req:modules-runtime-002 req:cli-bootstrap-004 req:modules-runtime-006
fn resolver_network_data_package_artifacts_and_registry_graph_preserve_identity() {
    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    fake.files
        .borrow_mut()
        .insert("/plain.json".into(), declaration("PLAIN").into_bytes());
    fake.files.borrow_mut().insert(
        "/pkg/bin/ast/src/module.uffda.ast.json".into(),
        declaration("PKG").into_bytes(),
    );
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
    );
    version(&fake, "1.0.0", r#"{"exports":{".":"./module.json"}}"#, &[
        ("module.json", json!({"imports":[{"kind":"module","moduleUrl":"./leaf.json","names":["LEAF"]}],"exports":[{"kind":"import","name":"LEAF"}],"rules":[]}).to_string()),
        ("leaf.json", declaration("LEAF")),
    ]);
    let mut resolver = super::super::Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
    resolver.set_transport(fake.clone());
    let direct = Url::parse("https://data.test/plain.json").unwrap();
    assert_eq!(
        resolver.load_declaration(&direct).unwrap().rules[0]["name"],
        "PLAIN"
    );
    resolver
        .add_artifact_package(Url::parse("https://data.test/pkg/").unwrap(), "./bin")
        .unwrap();
    let logical = Url::parse("https://data.test/pkg/src/module.uff").unwrap();
    assert_eq!(
        resolver.load_declaration(&logical).unwrap().rules[0]["name"],
        "PKG"
    );
    assert!(
        !fake
            .requests
            .borrow()
            .iter()
            .any(|path| path.ends_with("src/module.uff"))
    );
    resolver.set_packages(setup(&dir, fake.clone(), Lockfile::memory()));
    let specified = Url::parse("jsr:@acme/kv@1.0.0").unwrap();
    let graph = resolver.load_graph(&specified).unwrap();
    assert_eq!(
        graph.entry.as_str(),
        "https://registry.test/@acme/kv/1.0.0/module.json"
    );
    assert_eq!(
        graph.modules[&graph.entry].exports["LEAF"]
            .module_url
            .as_str(),
        "https://registry.test/@acme/kv/1.0.0/leaf.json"
    );
    assert!(Rc::ptr_eq(
        &resolver.load_graph(&graph.entry).unwrap(),
        &graph
    ));
    let malformed = Url::parse("https://registry.test/@acme/kv/1.0.0/leaf.json?bypass").unwrap();
    assert!(resolver.load_declaration(&malformed).is_err());
}

#[test]
// req:modules-runtime-006
fn package_graph_rejects_aliases_and_relative_escape_without_fetching_target() {
    for target in ["@acme/kv", "../../2.0.0/leaf.json"] {
        let dir = Directory::new();
        let fake = Rc::new(FakeTransport::default());
        fake.files.borrow_mut().insert(
            "/@acme/kv/meta.json".into(),
            json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
        );
        version(&fake, "1.0.0", r#"{"exports":{".":"./src/module.json"},"imports":{"@acme/kv":"jsr:@acme/kv@1.0.0"}}"#, &[
            ("src/module.json", json!({"imports":[{"kind":"module","moduleUrl":target,"names":[]}],"exports":[],"rules":[]}).to_string()),
        ]);
        let mut resolver = super::super::Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
        resolver.set_packages(setup(&dir, fake.clone(), Lockfile::memory()));
        let result = resolver.load_graph(&Url::parse("jsr:@acme/kv@1.0.0").unwrap());
        assert!(result.is_err());
        assert!(
            !fake
                .requests
                .borrow()
                .iter()
                .any(|path| path.contains("2.0.0"))
        );
    }
}

#[test]
// req:modules-runtime-006
fn lockfile_validates_shape_and_writes_sorted_keys() {
    let dir = Directory::new();
    let path = dir.0.join("uffda.lock");
    for text in [
        "null",
        "[]",
        "{}",
        r#"{"extra":true}"#,
        r#"{"specifiers":[]}"#,
        r#"{"jsr":{"@a/b@1":{"integrity":42}}}"#,
        r#"{"jsr":{"@a/b@1":["hash"]}}"#,
    ] {
        std::fs::write(&path, text).unwrap();
        if text == "{}" {
            assert!(Lockfile::load(path.clone()).is_ok());
        } else {
            assert!(Lockfile::load(path.clone()).is_err(), "{text}");
        }
    }
    std::fs::remove_file(&path).unwrap();
    let mut lock = Lockfile::load(path.clone()).unwrap();
    lock.version("z".into(), "1.0.0".into()).unwrap();
    lock.version("a".into(), "2.0.0".into()).unwrap();
    let text = std::fs::read_to_string(path).unwrap();
    assert!(text.find("\"a\"").unwrap() < text.find("\"z\"").unwrap());
    assert!(text.ends_with('\n'));
}

#[test]
// req:modules-runtime-006
fn failed_lockfile_save_restores_version_and_integrity_records() {
    let dir = Directory::new();
    let mut lock = Lockfile::load(dir.0.join("missing/uffda.lock")).unwrap();
    assert!(lock.version("new".into(), "1.0.0".into()).is_err());
    assert!(!lock.data.specifiers.contains_key("new"));
    lock.data
        .specifiers
        .insert("existing".into(), "1.0.0".into());
    assert!(lock.version("existing".into(), "2.0.0".into()).is_err());
    assert_eq!(lock.data.specifiers["existing"], "1.0.0");
    assert!(lock.integrity("new".into(), "hash".into()).is_err());
    assert!(!lock.data.jsr.contains_key("new"));
    lock.data.jsr.insert(
        "existing".into(),
        Integrity {
            integrity: "old".into(),
        },
    );
    assert!(lock.integrity("existing".into(), "new".into()).is_err());
    assert_eq!(lock.data.jsr["existing"].integrity, "old");
}

#[test]
// req:modules-runtime-006 req:modules-runtime-002
fn selected_build_metadata_version_loads_and_failed_save_does_not_reuse_selection() {
    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.0.0+build":{}}})
            .to_string()
            .into_bytes(),
    );
    version(
        &fake,
        "1.0.0+build",
        r#"{"exports":{".":"./module.json"}}"#,
        &[("module.json", declaration("BUILD"))],
    );
    let mut packages = setup(&dir, fake.clone(), Lockfile::memory());
    let url = packages.resolve("jsr:@acme/kv@1.0.0+build").unwrap();
    assert_eq!(packages.load(&url).unwrap().rules[0]["name"], "BUILD");

    let lockfile = Lockfile::load(dir.0.join("missing/uffda.lock")).unwrap();
    let mut packages = setup(&dir, fake, lockfile);
    assert!(packages.resolve("jsr:@acme/kv@1.0.0+build").is_err());
    assert!(!packages.chosen.contains_key("@acme/kv"));
    assert!(packages.lockfile.data.specifiers.is_empty());
}

#[test]
// req:modules-runtime-002
fn blocking_http_transport_reads_data_and_reports_http_failures() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let worker = std::thread::spawn(move || {
        for status in ["200 OK", "404 Not Found"] {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 4096];
            let count = stream.read(&mut request).unwrap();
            assert!(count > 0);
            let body = r#"{"imports":[],"exports":[],"rules":[]}"#;
            write!(stream, "HTTP/1.1 {status}\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    let url = Url::parse(&format!("http://{address}/module.json")).unwrap();
    let bytes = HttpTransport.read(&url).unwrap();
    assert!(decode_declaration(&url, std::str::from_utf8(&bytes).unwrap()).is_ok());
    assert!(HttpTransport.read(&url).unwrap_err().contains("404"));
    worker.join().unwrap();
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .canonicalize()
        .unwrap()
}

fn publish_package_files(fake: &FakeTransport, package: &str, version: &str) {
    let root = repo_root();
    let mut files = BTreeMap::from([(
        "uffda.jsonc".to_string(),
        std::fs::read_to_string(root.join("uffda.jsonc")).unwrap(),
    )]);
    let mut pending = vec![root.join("bin")];
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
                let relative = path
                    .strip_prefix(&root)
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .replace('\\', "/");
                files.insert(relative, std::fs::read_to_string(path).unwrap());
            }
        }
    }
    fake.files.borrow_mut().insert(
        format!("/{package}/meta.json"),
        json!({"versions":{version:{}}}).to_string().into_bytes(),
    );
    let mut manifest = BTreeMap::new();
    for (path, text) in &files {
        manifest.insert(
            format!("/{path}"),
            json!({"checksum":format!("sha256-{}", sha256(text.as_bytes()))}),
        );
        fake.files.borrow_mut().insert(
            format!("/{package}/{version}/{path}"),
            text.as_bytes().to_vec(),
        );
    }
    fake.files.borrow_mut().insert(
        format!("/{package}/{version}_meta.json"),
        json!({"manifest":manifest}).to_string().into_bytes(),
    );
}

#[test]
// req:cli-distribution-006
fn remport_jsr_package_exports_resolve_and_tokenizer_runs() {
    use crate::languages::{Language, Languages};
    use crate::module::CompiledModuleGraph;
    use crate::pattern::MatchKind;
    use crate::runtime::{InputMode, Runtime};

    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    publish_package_files(&fake, "@justinmchase/uffda", "1.0.0");
    let mut packages = setup(&dir, fake.clone(), Lockfile::memory());
    for name in [
        "tokenizer",
        "tokenizer-lang",
        "pattern",
        "expression",
        "imports",
        "exports",
        "language",
    ] {
        packages
            .resolve(&format!("jsr:@justinmchase/uffda@^1/{name}"))
            .unwrap_or_else(|error| panic!("{name}: {}", error.message));
    }

    let mut languages = Languages::new().unwrap();
    let source = "import \"jsr:@justinmchase/uffda@^1/tokenizer\" Tokenizer;\n\
export rule Main = t:Tokenizer -> t;\n";
    let declaration = {
        let syntax = languages.parse(source, Language::Uffda).expect("parse");
        let lowered = languages.compile(syntax).expect("compile");
        serde_json::to_string(&lowered).unwrap()
    };
    let mut resolver = super::super::Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
    resolver.set_packages(packages);
    let url = Url::parse("file:///uffda-cli-distribution-006/main.uff").unwrap();
    resolver.insert_declaration(url.clone(), decode_declaration(&url, &declaration).unwrap());
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("load graph"))
            .expect("compile graph"),
    );
    let mut runtime = Runtime::with_mode(
        graph,
        &url,
        Some("Main"),
        json!("hello world"),
        InputMode::Iterable,
    )
    .unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().expect("result");
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(execution.is_clean());
    });
    let text = runtime.serialize_result().unwrap().unwrap();
    let tokens: serde_json::Value = serde_json::from_str(&text).unwrap();
    let kinds: Vec<_> = tokens
        .as_array()
        .unwrap()
        .iter()
        .map(|token| token["kind"].as_str().unwrap())
        .collect();
    assert_eq!(kinds, ["word", "whitespace", "word"]);
}

#[test]
// req:cli-distribution-007
fn remport_jsr_public_grammar_exports_and_raw_rules_compose() {
    use crate::languages::{Language, Languages};
    use crate::module::CompiledModuleGraph;
    use crate::pattern::MatchKind;
    use crate::runtime::{InputMode, Runtime};

    let root = repo_root();
    let deno: serde_json::Value = jsonc_parser::parse_to_serde_value(
        &std::fs::read_to_string(root.join("deno.jsonc")).unwrap(),
        &Default::default(),
    )
    .unwrap()
    .unwrap();
    let grammar: serde_json::Value = jsonc_parser::parse_to_serde_value(
        &std::fs::read_to_string(root.join("uffda.jsonc")).unwrap(),
        &Default::default(),
    )
    .unwrap()
    .unwrap();
    let exports = deno["exports"].as_object().unwrap();
    assert_eq!(exports["./grammar"], "./src/lang/grammar.ts");
    assert_eq!(exports["./runtime"], "./src/runtime/public.ts");
    assert_eq!(
        exports["./tokenizer"],
        "./src/lang/tokenizer/tokenizer.lang.ts"
    );
    assert_eq!(exports["./pattern"], "./src/lang/pattern/pattern.lang.ts");
    assert_eq!(
        exports["./expression"],
        "./src/lang/expression/expression.lang.ts"
    );
    assert_eq!(exports["./uffda"], "./src/lang/uffda/uffda.lang.ts");
    assert_eq!(
        exports["./language-metadata"],
        "./src/cli/language_metadata.ts"
    );
    assert_eq!(grammar["exports"]["./source"], "./src/lang/source/mod.uff");

    let mut languages = Languages::new().unwrap();
    assert!(languages.parse("any", Language::Pattern).is_ok());
    assert!(languages.parse("42", Language::Expression).is_ok());
    {
        let mut resolver = super::super::Resolver::from_cwd().unwrap();
        let builtin_root = crate::builtins::register(&mut resolver).unwrap();
        let url = builtin_root
            .join("src/lang/tokenizer/tokenizer.lang.uff")
            .unwrap();
        let graph =
            Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
        let mut runtime = Runtime::with_mode(
            graph,
            &url,
            Some("TokenizerLang"),
            json!("one two"),
            InputMode::Scalar,
        )
        .unwrap();
        runtime.run().unwrap();
        runtime.read(|execution| assert!(execution.is_clean()));
    }

    let dir = Directory::new();
    let fake = Rc::new(FakeTransport::default());
    publish_package_files(&fake, "@justinmchase/uffda", "1.0.0");

    let cases = [
        ("pattern", "Pattern", json!(["any"]), json!({"kind":"any"})),
        (
            "pattern-syntax",
            "Pattern",
            json!(["any"]),
            json!({"kind":"any"}),
        ),
        (
            "expression",
            "Expression",
            json!(["42"]),
            json!({"kind":"number","value":42}),
        ),
        (
            "expression-syntax",
            "Expression",
            json!(["42"]),
            json!({"kind":"number","value":42}),
        ),
    ];
    for (specifier, name, input, expected) in cases {
        let source = format!(
            "import \"jsr:@justinmchase/uffda@^1/{specifier}\" {name};\nexport rule Main = {name};"
        );
        let declaration = {
            let syntax = languages.parse(&source, Language::Uffda).expect("parse");
            let lowered = languages.compile(syntax).expect("compile");
            serde_json::to_string(&lowered).unwrap()
        };
        let mut resolver = super::super::Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
        resolver.set_packages(setup(&dir, fake.clone(), Lockfile::memory()));
        let url = Url::parse("file:///uffda-cli-distribution-007/raw.uff").unwrap();
        resolver.insert_declaration(url.clone(), decode_declaration(&url, &declaration).unwrap());
        let graph = Rc::new(
            CompiledModuleGraph::compile(resolver.load_graph(&url).expect("load graph"))
                .expect("compile graph"),
        );
        let mut runtime =
            Runtime::with_mode(graph, &url, Some("Main"), input, InputMode::Iterable).unwrap();
        runtime.run().unwrap();
        runtime.read(|execution| {
            assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
            assert!(execution.is_clean());
        });
        let text = runtime.serialize_result().unwrap().unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&text).unwrap(),
            expected
        );
    }

    let mut packages = setup(&dir, fake, Lockfile::memory());
    for name in [
        "tokenizer",
        "tokenizer-lang",
        "pattern",
        "expression",
        "imports",
        "exports",
        "language",
        "source",
    ] {
        packages
            .resolve(&format!("jsr:@justinmchase/uffda@^1/{name}"))
            .unwrap_or_else(|error| panic!("{name}: {}", error.message));
    }
}

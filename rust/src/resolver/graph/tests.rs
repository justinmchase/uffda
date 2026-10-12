use super::*;
use serde_json::Value;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

#[test]
// req:runtime-strings-002
fn linked_declarations_keep_lossless_json_literal_payloads() {
    let url = Url::parse("file:///lossless-graph.json").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver.insert_declaration(url.clone(), super::super::decode_declaration(&url, r#"{"imports":[],"exports":[{"kind":"func","name":"Text"}],"rules":[],"funcs":[{"name":"Text","pattern":{"kind":"end"},"expression":{"kind":"value","value":"\ud800"}}]}"#).unwrap());
    let graph = resolver.load_graph(&url).unwrap();
    let declaration = &graph.modules[&url].declaration.funcs[0];
    let crate::json::JsonValue::String(text) = &declaration["expression"]["value"] else {
        panic!()
    };
    assert_eq!(text.as_utf16(), &[0xd800]);
}

#[test]
// req:project-file-002
fn compilation_and_resolution_share_segment_bounded_alias_unfurling() {
    let imports = BTreeMap::from([("@acme/kv".into(), "jsr:@acme/kv@^1.2.0".into())]);
    assert_eq!(
        unfurl_specifier(&imports, "@acme/kv/tokens").unwrap(),
        "jsr:@acme/kv@^1.2.0/tokens"
    );
    assert_eq!(
        unfurl_specifier(&imports, "@acme/kv").unwrap(),
        "jsr:@acme/kv@^1.2.0"
    );
    assert_eq!(
        unfurl_specifier(&imports, "./tokens.uff").unwrap(),
        "./tokens.uff"
    );
    assert!(unfurl_specifier(&imports, "@acme/kvx").is_err());
    assert!(unfurl_specifier(&imports, "@missing/name").is_err());
}

struct Directory(std::path::PathBuf);
impl Directory {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "uffda-graph-{}-{}",
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

fn rule(name: &str) -> Value {
    json!({"name":name,"parameters":[],"pattern":{"kind":"any"}})
}
fn declaration(imports: Value, exports: Value, rules: Value) -> ModuleDeclaration {
    super::super::decode_declaration(
        &Url::parse("file:///fixture.json").unwrap(),
        &json!({"imports":imports,"exports":exports,"rules":rules}).to_string(),
    )
    .unwrap()
}
fn seed(resolver: &mut Resolver, url: Url, imports: Value, exports: Value, rules: Value) {
    resolver.insert_declaration(url, declaration(imports, exports, rules));
}

#[test]
// req:modules-runtime-001 req:modules-runtime-004 req:modules-runtime-005
fn relative_graph_reexports_and_default_exports_preserve_member_identity() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    let main = dir.url("main.json");
    let leaf = dir.url("leaf.json");
    seed(
        &mut resolver,
        leaf.clone(),
        json!([]),
        json!([{"kind":"rule","name":"R","default":true}]),
        json!([rule("R")]),
    );
    seed(
        &mut resolver,
        main.clone(),
        json!([{"kind":"module","moduleUrl":"./leaf.json","names":["R"]}]),
        json!([{"kind":"import","name":"R","default":true}]),
        json!([]),
    );
    let graph = resolver.load_graph(&main).unwrap();
    assert_eq!(graph.modules[&main].default, graph.modules[&leaf].default);
    assert_eq!(graph.modules[&main].exports["R"].module_url, leaf);
    assert!(Rc::ptr_eq(&graph, &resolver.load_graph(&main).unwrap()));
}

#[test]
// req:modules-runtime-005
fn nested_missing_imports_record_ordered_import_chain_and_no_failed_graph_cache() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    let main = dir.url("main.json");
    let middle = dir.url("middle.json");
    let leaf = dir.url("leaf.json");
    seed(
        &mut resolver,
        main.clone(),
        json!([{"kind":"module","moduleUrl":"./middle.json","names":["R"]}]),
        json!([]),
        json!([]),
    );
    seed(
        &mut resolver,
        middle.clone(),
        json!([{"kind":"module","moduleUrl":"./leaf.json","names":["R"]}]),
        json!([{"kind":"import","name":"R"}]),
        json!([]),
    );
    for _ in 0..2 {
        let failure = match resolver.load_graph(&main) {
            Ok(_) => panic!("expected missing module"),
            Err(e) => e,
        };
        assert_eq!(failure.import_chain.len(), 2);
        assert_eq!(failure.import_chain[0].importer_url, main.as_str());
        assert_eq!(failure.import_chain[1].importer_url, middle.as_str());
        assert_eq!(
            failure.import_chain[1].resolved_url.as_deref(),
            Some(leaf.as_str())
        );
    }
    seed(
        &mut resolver,
        leaf,
        json!([]),
        json!([{"kind":"rule","name":"R"}]),
        json!([rule("R")]),
    );
    assert!(resolver.load_graph(&main).is_ok());
}

#[test]
// req:modules-runtime-004 req:modules-runtime-005
fn unknown_exports_local_import_conflicts_and_duplicate_defaults_fail() {
    let dir = Directory::new();
    for (imports, exports, rules) in [
        (
            json!([]),
            json!([{"kind":"rule","name":"missing"}]),
            json!([]),
        ),
        (
            json!([]),
            json!([{"kind":"rule","name":"R","default":true},{"kind":"rule","name":"R","default":true}]),
            json!([rule("R")]),
        ),
        (
            json!([{"kind":"module","moduleUrl":"./leaf.json","names":["R"]}]),
            json!([]),
            json!([rule("R")]),
        ),
        (
            json!([{"kind":"module","moduleUrl":"./leaf.json","names":["missing"]}]),
            json!([]),
            json!([]),
        ),
    ] {
        let mut resolver = dir.resolver();
        let main = dir.url("main.json");
        seed(
            &mut resolver,
            dir.url("leaf.json"),
            json!([]),
            json!([{"kind":"rule","name":"R"}]),
            json!([rule("R")]),
        );
        seed(&mut resolver, main.clone(), imports, exports, rules);
        assert!(resolver.load_graph(&main).is_err());
    }
}

#[test]
// req:modules-runtime-003
fn native_declaration_payload_is_injected_without_loading_executable_file() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    let main = dir.url("host.ts");
    let payload = json!({"imports":[],"exports":[{"kind":"rule","name":"R"}],"rules":[rule("R")]});
    seed(
        &mut resolver,
        main.clone(),
        json!([{"kind":"native","moduleUrl":"./provided.ts","names":["R"],"module":payload}]),
        json!([{"kind":"import","name":"R"}]),
        json!([]),
    );
    let graph = resolver.load_graph(&main).unwrap();
    assert_eq!(
        graph.modules[&main].exports["R"].module_url,
        dir.url("provided.ts")
    );
    assert!(!dir.0.join("provided.ts").exists());
}

#[test]
// req:modules-runtime-004 req:runtime-memory-002
fn cyclic_modules_link_local_exports_without_owning_pointer_cycles() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    let a = dir.url("a.json");
    let b = dir.url("b.json");
    seed(
        &mut resolver,
        a.clone(),
        json!([{"kind":"module","moduleUrl":"./b.json","names":["B"]}]),
        json!([{"kind":"rule","name":"A"}]),
        json!([rule("A")]),
    );
    seed(
        &mut resolver,
        b.clone(),
        json!([{"kind":"module","moduleUrl":"./a.json","names":["A"]}]),
        json!([{"kind":"rule","name":"B"}]),
        json!([rule("B")]),
    );
    let graph = resolver.load_graph(&a).unwrap();
    assert_eq!(graph.modules[&a].imports["B"].module_url, b);
    assert_eq!(graph.modules[&b].imports["A"].module_url, a);
    let weak = Rc::downgrade(&graph);
    drop(graph);
    drop(resolver);
    assert!(weak.upgrade().is_none());
}

#[test]
// req:modules-runtime-004
fn unresolved_reexport_cycle_fails_instead_of_looping() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    for (name, target) in [("a.json", "./b.json"), ("b.json", "./a.json")] {
        seed(
            &mut resolver,
            dir.url(name),
            json!([{"kind":"module","moduleUrl":target,"names":["R"]}]),
            json!([{"kind":"import","name":"R"}]),
            json!([]),
        );
    }
    assert!(resolver.load_graph(&dir.url("a.json")).is_err());
}

#[test]
// req:modules-runtime-004
fn later_import_binding_wins_without_linking_oscillation() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    for name in ["a.json", "b.json"] {
        seed(
            &mut resolver,
            dir.url(name),
            json!([]),
            json!([{"kind":"rule","name":"R"}]),
            json!([rule("R")]),
        );
    }
    let main = dir.url("main.json");
    seed(
        &mut resolver,
        main.clone(),
        json!([
            {"kind":"module","moduleUrl":"./a.json","names":["R"]},
            {"kind":"module","moduleUrl":"./b.json","names":["R"]}
        ]),
        json!([{"kind":"import","name":"R"}]),
        json!([]),
    );
    assert_eq!(
        resolver.load_graph(&main).unwrap().modules[&main].exports["R"].module_url,
        dir.url("b.json")
    );
}

#[test]
// req:modules-runtime-006
fn import_map_is_segment_based_and_cannot_overlap_or_redirect_relative_imports() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    assert!(
        resolver
            .set_import_map(BTreeMap::from([
                ("@acme".into(), "jsr:@acme/kv".into()),
                ("@acme/kv".into(), "jsr:@acme/kv".into())
            ]))
            .is_err()
    );
    resolver
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@1.0.0".into(),
        )]))
        .unwrap();
    let provided = Url::parse("jsr:@acme/kv@1.0.0/tokens").unwrap();
    seed(
        &mut resolver,
        provided.clone(),
        json!([]),
        json!([{"kind":"rule","name":"R"}]),
        json!([rule("R")]),
    );
    let main = dir.url("main.json");
    seed(
        &mut resolver,
        main.clone(),
        json!([{"kind":"module","moduleUrl":"@acme/kv/tokens","names":["R"]}]),
        json!([]),
        json!([]),
    );
    assert_eq!(
        resolver.load_graph(&main).unwrap().modules[&main].imports["R"].module_url,
        provided
    );
    assert!(resolver.resolve_import(&main, "@acme/kvx/tokens").is_err());
}

#[test]
// req:modules-runtime-005 req:runtime-memory-005
fn deep_module_graph_uses_explicit_worklist() {
    let dir = Directory::new();
    let mut resolver = dir.resolver();
    for index in 0..5000 {
        let imports = if index == 4999 {
            json!([])
        } else {
            json!([{"kind":"module","moduleUrl":format!("./{}.json", index + 1),"names":[]}])
        };
        seed(
            &mut resolver,
            dir.url(&format!("{index}.json")),
            imports,
            json!([]),
            json!([]),
        );
    }

    assert_eq!(
        resolver
            .load_graph(&dir.url("0.json"))
            .unwrap()
            .modules
            .len(),
        5000
    );
}

#[test]
// req:modules-runtime-001 req:modules-runtime-003 req:modules-runtime-004 req:modules-runtime-005
fn shared_module_graph_corpus_matches_typescript() {
    #[derive(Deserialize)]
    struct Fixture {
        name: String,
        entry: String,
        modules: BTreeMap<String, Value>,
        exports: BTreeMap<String, String>,
        default: Option<String>,
        error: bool,
    }

    let fixtures: Vec<Fixture> = serde_json::from_str(include_str!(
        "../../../../test/rust/module-graph-fixtures.json"
    ))
    .unwrap();
    let root = Url::parse("file:///uffda-shared-module-graph/").unwrap();
    for fixture in fixtures {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        for (name, declaration) in fixture.modules {
            let url = root.join(&name).unwrap();
            resolver.insert_declaration(
                url.clone(),
                super::super::decode_declaration(&url, &declaration.to_string()).unwrap(),
            );
        }
        let result = resolver.load_graph(&root.join(&fixture.entry).unwrap());
        assert_eq!(result.is_err(), fixture.error, "{}", fixture.name);
        if let Ok(graph) = result {
            let module = &graph.modules[&graph.entry];
            let exports: BTreeMap<_, _> = module
                .exports
                .iter()
                .map(|(name, value)| {
                    (
                        name.clone(),
                        value
                            .module_url
                            .as_str()
                            .strip_prefix(root.as_str())
                            .unwrap()
                            .to_string(),
                    )
                })
                .collect();
            assert_eq!(exports, fixture.exports, "{}", fixture.name);
            assert_eq!(
                module.default.as_ref().map(|value| value
                    .module_url
                    .as_str()
                    .strip_prefix(root.as_str())
                    .unwrap()
                    .to_string()),
                fixture.default,
                "{}",
                fixture.name
            );
        }
    }
}

#[test]
// req:modules-runtime-002 req:modules-runtime-005
fn graph_rejects_sequence_shaped_imports_and_exports() {
    let dir = Directory::new();
    let url = dir.url("invalid.json");
    for (imports, exports) in [
        (json!([["module", "./leaf.json", [], null]]), json!([])),
        (json!([]), json!([["rule", "R", false]])),
    ] {
        let mut resolver = dir.resolver();
        seed(
            &mut resolver,
            url.clone(),
            imports,
            exports,
            json!([rule("R")]),
        );
        assert!(resolver.load_graph(&url).is_err());
    }
}

use super::{Execution, InputMode, Runtime};
use crate::environment::Environment;
use crate::evaluate::ExpressionExecution;
use crate::expression::Expression;
use crate::globals::json_text;
use crate::module::{CompiledModuleGraph, ModuleBindings};
use crate::pattern::{Pattern, PatternExecution, PatternKind, ResolveTargetKind};
use crate::provenance::Origin;
use crate::resolver::packages::{JsrPackages, Lockfile, Transport, sha256};
use crate::resolver::{Resolver, decode_declaration};
use crate::value::HostCallable;
use crate::value::Value;
use serde_json::{Value as Json, json};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::{AtomicU64, Ordering};
use uffda_heap::Gc;
use url::Url;

fn compile_files(files: &[(&str, Json)]) -> (Rc<CompiledModuleGraph>, Url) {
    let mut resolver = Resolver::from_cwd().unwrap();
    let entry = Url::parse(files[0].0).unwrap();
    for (href, module) in files {
        let url = Url::parse(href).unwrap();
        resolver.insert_declaration(
            url.clone(),
            decode_declaration(&url, &module.to_string()).unwrap(),
        );
    }
    (
        Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&entry).unwrap()).unwrap()),
        entry,
    )
}

fn compile_one(module: Json) -> (Rc<CompiledModuleGraph>, Url) {
    compile_files(&[("file:///module-port.json", module)])
}

fn reference(name: &str) -> Json {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":[]})
}

fn equal(value: &str) -> Json {
    json!({"kind":"equal","value":{"kind":"value.literal","value":value}})
}

fn rule(name: &str, pattern: Json) -> Json {
    json!({"name":name,"parameters":[],"pattern":pattern})
}

fn exported(name: &str) -> Json {
    json!({
        "imports": [],
        "exports": [{"kind":"rule","name":name,"default":true}],
        "rules": [],
    })
}

fn execute_module(module: Json, input: &str) -> Runtime {
    let (graph, url) = compile_one(module);
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!(input), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime
}

fn execute_files(files: &[(&str, Json)], input: &str) -> Runtime {
    let (graph, url) = compile_files(files);
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!(input), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime
}

fn matched(runtime: &Runtime) -> Json {
    let text = runtime.read(|execution| {
        json_text(execution.result().expect("match result").value)
            .unwrap()
            .unwrap()
    });
    serde_json::from_str(&text).unwrap()
}

fn outcome(runtime: &Runtime) -> (crate::pattern::MatchKind, usize, bool) {
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        (result.kind, result.end, result.recovered)
    })
}

fn metadata_json(module: Json, name: &str) -> Json {
    let (graph, url) = compile_one(module);
    let member = graph.resolve(&url, name).unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    serde_json::from_str(&runtime.serialize_metadata(&member).unwrap().unwrap()).unwrap()
}

fn decorator(name: &str, pattern: Json, expression: Json) -> Json {
    json!({"name":name,"pattern":pattern,"expression":expression})
}

fn value_expr(value: Json) -> Json {
    json!({"kind":"value","value":value})
}

struct TempDir(PathBuf);

impl TempDir {
    fn new(prefix: &str) -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "{prefix}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn url(&self, name: &str) -> Url {
        Url::from_file_path(self.0.join(name)).unwrap()
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).ok();
    }
}

#[derive(Default)]
struct FakeTransport {
    files: RefCell<BTreeMap<String, Vec<u8>>>,
}

impl Transport for FakeTransport {
    fn read(&self, url: &Url) -> Result<Vec<u8>, String> {
        self.files
            .borrow()
            .get(url.path())
            .cloned()
            .ok_or_else(|| format!("{url} was not found"))
    }
}

fn sha_file(fake: &FakeTransport, version: &str, path: &str, text: &str) {
    fake.files.borrow_mut().insert(
        format!("/@acme/kv/{version}/{path}"),
        text.as_bytes().to_vec(),
    );
}

fn publish_version(fake: &FakeTransport, version: &str, project: &str, files: &[(&str, String)]) {
    let mut manifest = BTreeMap::new();
    manifest.insert(
        "/uffda.jsonc".into(),
        json!({"checksum": format!("sha256-{}", sha256(project.as_bytes()))}),
    );
    sha_file(fake, version, "uffda.jsonc", project);
    for (path, text) in files {
        manifest.insert(
            format!("/{path}"),
            json!({"checksum": format!("sha256-{}", sha256(text.as_bytes()))}),
        );
        sha_file(fake, version, path, text);
    }
    fake.files.borrow_mut().insert(
        format!("/@acme/kv/{version}_meta.json"),
        json!({"manifest": manifest}).to_string().into_bytes(),
    );
}

fn declaration(name: &str, imports: Json) -> String {
    json!({
        "imports": imports,
        "exports": [{"kind":"rule","name":name}],
        "rules": [{"name":name,"parameters":[],"pattern":{"kind":"any"}}]
    })
    .to_string()
}

fn must_fail_graph(
    result: Result<Rc<crate::resolver::graph::ModuleGraph>, crate::resolver::ModuleResolutionError>,
) -> crate::resolver::ModuleResolutionError {
    match result {
        Err(error) => error,
        Ok(_) => panic!("expected module resolution to fail"),
    }
}

fn drive_now<F: std::future::Future>(future: F) -> F::Output {
    struct Noop;
    impl std::task::Wake for Noop {
        fn wake(self: std::sync::Arc<Self>) {}
    }
    let waker = std::task::Waker::from(std::sync::Arc::new(Noop));
    let mut cx = std::task::Context::from_waker(&waker);
    let mut future = Box::pin(future);
    for _ in 0..10_000 {
        if let std::task::Poll::Ready(result) = future.as_mut().poll(&mut cx) {
            return result;
        }
    }
    panic!("drive exceeded bounded polls");
}

fn rule_name(node: &crate::pattern::PatternMatch<'_>) -> Option<String> {
    let meta = node.rule?;
    match meta.subject {
        Value::Declaration(declaration) => Some(declaration.compiled.name.clone()),
        _ => None,
    }
}

fn each_match<'gc>(
    root: Gc<'gc, crate::pattern::PatternMatch<'gc>>,
    mut visit: impl FnMut(Gc<'gc, crate::pattern::PatternMatch<'gc>>),
) {
    let mut stack = vec![root];
    let mut seen = HashSet::new();
    while let Some(node) = stack.pop() {
        if !seen.insert(Gc::as_ptr(node) as usize) {
            continue;
        }
        stack.extend(node.children.iter().copied());
        visit(node);
    }
}

#[test]
// req:expressions-runtime-011
fn modport_info_rule_info_is_shared_plain_data() {
    let url = Url::parse("file:///fit.uff").unwrap();
    let (graph, _) = compile_files(&[(
        url.as_str(),
        json!({
            "imports": [],
            "exports": [{"kind":"rule","name":"Fit"}],
            "rules": [{
                "name": "Fit",
                "parameters": [{"name":"B"},{"name":"L"}],
                "pattern": {"kind":"ok"},
                "metadata": {"Doc": "hidden"}
            }]
        }),
    )]);
    uffda_heap::rootless_mutate(|mc| {
        let bindings = ModuleBindings::new(mc, &graph).unwrap();
        let info = bindings.environment(&url).unwrap().get("Fit").unwrap();
        assert!(info.strict_eq(bindings.environment(&url).unwrap().get("Fit").unwrap()));
        let member = graph.resolve(&url, "Fit").unwrap();
        assert!(!info.strict_eq(bindings.declaration(&member).unwrap()));
        let text = json_text(info).unwrap().unwrap();
        assert_eq!(
            serde_json::from_str::<Json>(&text).unwrap(),
            json!({
                "kind": "rule",
                "name": "Fit",
                "moduleUrl": url.as_str(),
                "parameters": ["B", "L"]
            })
        );
        assert_eq!(
            serde_json::from_str::<Json>(&text).unwrap().to_string(),
            text
        );
    });
}

#[test]
// req:expressions-runtime-003 req:expressions-runtime-005 req:expressions-runtime-008 req:runtime-core-007
fn modport_exec_immediate_values_finish_in_execution_state() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let origin = Origin { start: 0, end: 0 };
        let mut number = ExpressionExecution::new(
            mc,
            Expression::Number { value: 1.0 },
            environment,
            origin,
            Value::Number(7.0),
        );
        assert!(number.step(mc).unwrap());
        assert!(number.result().unwrap().strict_eq(Value::Number(1.0)));

        let mut reference = ExpressionExecution::new(
            mc,
            Expression::Reference { name: "_".into() },
            environment,
            origin,
            Value::Number(7.0),
        );
        assert!(reference.step(mc).unwrap());
        assert!(reference.result().unwrap().strict_eq(Value::Number(7.0)));
    });
}

#[test]
// req:cli-distribution-007 req:expressions-runtime-005 req:runtime-core-002
fn modport_public_match_and_expression_options() {
    let mut runtime =
        Runtime::for_pattern(Pattern::Any, json!(["token"]), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(matched(&runtime), json!("token"));
    assert!(runtime.read(|execution| execution.is_clean()));

    uffda_heap::rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let mut input = ExpressionExecution::new(
            mc,
            Expression::Reference { name: "_".into() },
            Environment::new(mc, None, vec![]),
            origin,
            Value::string(mc, "event"),
        );
        assert!(input.step(mc).unwrap());
        assert_eq!(
            json_text(input.result().unwrap()).unwrap().unwrap(),
            "\"event\""
        );

        let state = Value::object(mc, vec![("count".into(), Value::Number(3.0))]);
        let mut variable = ExpressionExecution::new(
            mc,
            Expression::Reference {
                name: "state".into(),
            },
            Environment::new(mc, None, vec![("state".into(), state)]),
            origin,
            Value::Undefined,
        );
        assert!(variable.step(mc).unwrap());
        assert_eq!(
            json_text(variable.result().unwrap()).unwrap().unwrap(),
            r#"{"count":3}"#
        );

        let mut missing = ExpressionExecution::new(
            mc,
            Expression::Reference {
                name: "notDeclared".into(),
            },
            Environment::new(mc, None, vec![]),
            origin,
            Value::Undefined,
        );
        assert_eq!(
            missing.step(mc).unwrap_err().to_string(),
            "unknown reference: notDeclared"
        );
    });
}

#[test]
// req:rule-decorators-004
fn modport_attr_presence_is_keyed_by_decorator_name() {
    let module = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Target","default":true}],
        "rules": [{
            "name": "Target",
            "parameters": [],
            "pattern": {"kind":"any"},
            "attributes": [
                {"name":"Inlined","args":[]},
                {"name":"First","args":[]},
                {"name":"Second","args":[]}
            ]
        }],
        "decorators": [
            decorator("Inlined", json!({"kind":"end"}), value_expr(json!("not-an-object"))),
            decorator("First", json!({"kind":"end"}), value_expr(json!({"kind":"first","a":1}))),
            decorator("Second", json!({"kind":"end"}), value_expr(json!({"kind":"second","a":1})))
        ]
    });
    let (graph, url) = compile_one(module);
    let member = graph.resolve(&url, "Target").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    let metadata: Json =
        serde_json::from_str(&runtime.serialize_metadata(&member).unwrap().unwrap()).unwrap();
    assert_eq!(metadata["Inlined"], "not-an-object");
    assert_eq!(metadata["First"], json!({"kind":"first","a":1}));
    assert_eq!(metadata["Second"], json!({"kind":"second","a":1}));
    assert_eq!(
        metadata.as_object().unwrap().keys().collect::<Vec<_>>(),
        ["Inlined", "First", "Second"]
    );
    runtime.read(|execution| {
        let record = execution
            .declarations
            .iter()
            .find(|record| record.member == member)
            .unwrap();
        let names: Vec<_> = record
            .attributes
            .borrow()
            .iter()
            .map(|attribute| {
                execution
                    .graph
                    .as_ref()
                    .unwrap()
                    .declaration(&attribute.decorator)
                    .unwrap()
                    .name
                    .clone()
            })
            .collect();
        assert_eq!(names, ["Inlined", "First", "Second"]);
    });
}

#[test]
// req:rule-decorators-003
fn modport_attr_this_is_the_decorated_declaration() {
    let metadata = metadata_json(
        json!({
            "imports": [],
            "exports": [{"kind":"rule","name":"Decorated","default":true}],
            "rules": [{
                "name": "Decorated",
                "parameters": [],
                "pattern": {"kind":"any"},
                "attributes": [{"name":"NameOf","args":[]}]
            }],
            "decorators": [decorator(
                "NameOf",
                json!({"kind":"end"}),
                json!({"kind":"object","keys":[{
                    "kind":"objectKey",
                    "name":"decoratedName",
                    "expression":{"kind":"member","name":"name","expression":{"kind":"reference","name":"this"}}
                }]})
            )]
        }),
        "Decorated",
    );
    assert_eq!(metadata, json!({"NameOf":{"decoratedName":"Decorated"}}));
}

#[test]
// req:rule-decorators-005
fn modport_attr_duplicate_and_unresolved_decorators_fail() {
    let duplicate = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Target"}],
        "rules": [{
            "name":"Target","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Once","args":[]},{"name":"Once","args":[]}]
        }],
        "decorators": [decorator("Once", json!({"kind":"end"}), value_expr(json!({"kind":"once"})))]
    }));
    let error = Runtime::metadata(duplicate.0).unwrap().run().unwrap_err();
    assert!(
        error.to_string().contains("applied more than once"),
        "{error}"
    );

    let missing = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Target"}],
        "rules": [{
            "name":"Target","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Missing","args":[]}]
        }]
    }));
    let error = Runtime::metadata(missing.0).unwrap().run().unwrap_err();
    assert!(
        error
            .to_string()
            .contains("unknown decorator reference: Missing"),
        "{error}"
    );

    let ordinary = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Target"}],
        "rules": [{
            "name":"Target","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"NotADecorator","args":[]}]
        }],
        "funcs": [decorator("NotADecorator", json!({"kind":"end"}), value_expr(json!({"kind":"nope"})))]
    }));
    let error = Runtime::metadata(ordinary.0).unwrap().run().unwrap_err();
    assert!(
        error
            .to_string()
            .contains("unknown decorator reference: NotADecorator"),
        "{error}"
    );
}

#[test]
// req:rule-decorators-003 req:rule-decorators-007
fn modport_attr_imports_self_application_and_raw_arguments() {
    let (graph, url) = compile_files(&[
        (
            "file:///decorated/main.json",
            json!({
                "imports": [{
                    "kind":"module",
                    "moduleUrl":"./library.json",
                    "names":["Imported"]
                }],
                "exports": [{"kind":"rule","name":"Target","default":true}],
                "rules": [{
                    "name":"Target","parameters":[],"pattern":{"kind":"any"},
                    "attributes":[{"name":"Imported","args":[]}]
                }]
            }),
        ),
        (
            "file:///decorated/library.json",
            json!({
                "imports": [],
                "exports": [{"kind":"decorator","name":"Imported"}],
                "rules": [],
                "decorators": [decorator(
                    "Imported",
                    json!({"kind":"end"}),
                    value_expr(json!({"kind":"imported"}))
                )]
            }),
        ),
    ]);
    let member = graph.resolve(&url, "Target").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        runtime.serialize_metadata(&member).unwrap().unwrap(),
        r#"{"Imported":{"kind":"imported"}}"#
    );

    let url = Url::parse("file:///same-name.json").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(
            &url,
            &json!({
                "imports": [],
                "exports": [],
                "rules": [],
                "funcs": [{
                    "name":"Example",
                    "pattern":{"kind":"end"},
                    "expression": value_expr(json!({"kind":"func"})),
                    "attributes":[{"name":"Example","args":[]}]
                }],
                "decorators": [decorator("Example", json!({"kind":"end"}), value_expr(json!({"kind":"example"})))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    assert!(
        must_fail_graph(resolver.load_graph(&url))
            .message
            .contains("duplicate local declaration Example")
    );

    let (graph, url) = compile_one(json!({
        "imports": [],
        "exports": [],
        "rules": [],
        "decorators": [{
            "name":"Self",
            "pattern":{"kind":"end"},
            "expression": value_expr(json!({"kind":"self"})),
            "attributes":[{"name":"Self","args":[]}]
        }]
    }));
    let itself = graph.resolve_decorator(&url, "Self").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        serde_json::from_str::<Json>(&runtime.serialize_metadata(&itself).unwrap().unwrap())
            .unwrap(),
        json!({"Self":{"kind":"self"}})
    );

    let (graph, url) = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Target"}],
        "rules": [{
            "name":"Target","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Tagged","args":[{"kind":"number","value":2}]}]
        }],
        "decorators": [decorator(
            "Tagged",
            json!({"kind":"any"}),
            value_expr(json!({"kind":"tagged","n":[1]}))
        )]
    }));
    let member = graph.resolve(&url, "Target").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        serde_json::from_str::<Json>(&runtime.serialize_metadata(&member).unwrap().unwrap())
            .unwrap(),
        json!({"Tagged":{"kind":"tagged","n":[1]}})
    );
    runtime.read(|execution| {
        let record = execution
            .declarations
            .iter()
            .find(|record| record.member == member)
            .unwrap();
        let arguments = &record.attributes.borrow()[0].arguments;
        assert!(arguments[0].strict_eq(Value::Number(2.0)));
    });
}

#[test]
// req:rule-decorators-003 req:rule-decorators-004 req:rule-decorators-007
fn modport_deco_attributes_record_metadata_for_rules_funcs_and_decorators() {
    assert_eq!(
        metadata_json(
            json!({
                "imports": [],
                "exports": [{"kind":"rule","name":"Main","default":true}],
                "rules": [{
                    "name":"Main","parameters":[],"pattern":{"kind":"any"},
                    "attributes":[{"name":"Deprecated","args":[value_expr(json!("superseded"))]}]
                }],
                "decorators": [decorator(
                    "Deprecated",
                    json!({"kind":"variable","name":"message","pattern":{"kind":"any"}}),
                    json!({"kind":"object","keys":[
                        {"kind":"objectKey","name":"kind","expression":value_expr(json!("deprecated"))},
                        {"kind":"objectKey","name":"message","expression":{"kind":"reference","name":"message"}}
                    ]})
                )]
            }),
            "Main",
        ),
        json!({"Deprecated":{"kind":"deprecated","message":"superseded"}})
    );

    let stacked = metadata_json(
        json!({
            "imports": [],
            "exports": [{"kind":"rule","name":"Main","default":true}],
            "rules": [{
                "name":"Main","parameters":[],"pattern":{"kind":"any"},
                "attributes":[{"name":"First","args":[]},{"name":"Second","args":[]}]
            }],
            "decorators": [
                decorator("First", json!({"kind":"end"}), value_expr(json!({"kind":"first","a":1}))),
                decorator("Second", json!({"kind":"end"}), value_expr(json!({"kind":"second","a":1})))
            ]
        }),
        "Main",
    );
    assert_eq!(stacked["First"]["kind"], "first");
    assert_eq!(stacked["Second"]["a"], 1);
    assert_ne!(stacked["First"], stacked["Second"]);

    assert_eq!(
        metadata_json(
            json!({
                "imports": [],
                "exports": [{"kind":"rule","name":"Main","default":true}],
                "rules": [rule("Main", json!({"kind":"any"}))],
                "funcs": [{
                    "name":"Decorated",
                    "pattern":{"kind":"end"},
                    "expression":{"kind":"reference","name":"_"},
                    "attributes":[{"name":"Example","args":[]}]
                }],
                "decorators": [decorator("Example", json!({"kind":"end"}), value_expr(json!({"kind":"example"})))]
            }),
            "Decorated",
        ),
        json!({"Example":{"kind":"example"}})
    );

    let collision = Resolver::from_cwd().unwrap();
    let url = Url::parse("file:///collision.json").unwrap();
    let mut collision = collision;
    collision.insert_declaration(
        url.clone(),
        decode_declaration(
            &url,
            &json!({
                "imports": [],
                "exports": [{"kind":"rule","name":"Main"}],
                "rules": [rule("Main", json!({"kind":"any"}))],
                "funcs": [decorator("Shared", json!({"kind":"end"}), value_expr(json!({"kind":"func"})))],
                "decorators": [decorator("Shared", json!({"kind":"end"}), value_expr(json!({"kind":"decorator"})))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    assert!(
        must_fail_graph(collision.load_graph(&url))
            .message
            .contains("duplicate local declaration Shared")
    );

    let (graph, url) = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [{
            "name":"Main","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Marker","args":[]}]
        }],
        "decorators": [
            decorator(
                "Note",
                json!({"kind":"variable","name":"n","pattern":{"kind":"any"}}),
                json!({"kind":"object","keys":[
                    {"kind":"objectKey","name":"note","expression":{"kind":"reference","name":"n"}},
                    {"kind":"objectKey","name":"of","expression":{"kind":"member","name":"name","expression":{"kind":"reference","name":"this"}}}
                ]})
            ),
            {
                "name":"Marker",
                "pattern":{"kind":"end"},
                "expression":{"kind":"boolean","value":true},
                "attributes":[{"name":"Note","args":[value_expr(json!("marks things"))]}]
            }
        ]
    }));
    let mut runtime = Runtime::metadata(graph.clone()).unwrap();
    runtime.run().unwrap();
    let marker = graph.resolve_decorator(&url, "Marker").unwrap();
    let main = graph.resolve(&url, "Main").unwrap();
    assert_eq!(
        serde_json::from_str::<Json>(&runtime.serialize_metadata(&marker).unwrap().unwrap())
            .unwrap(),
        json!({"Note":{"note":"marks things","of":"Marker"}})
    );
    assert_eq!(
        runtime.serialize_metadata(&main).unwrap().unwrap(),
        r#"{"Marker":true}"#
    );

    let (graph, url) = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [{
            "name":"Main","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Note","args":[value_expr(json!("main"))]}]
        }],
        "decorators": [{
            "name":"Note",
            "pattern":{"kind":"variable","name":"n","pattern":{"kind":"any"}},
            "expression": json!({"kind":"object","keys":[
                {"kind":"objectKey","name":"note","expression":{"kind":"reference","name":"n"}},
                {"kind":"objectKey","name":"of","expression":{"kind":"member","name":"name","expression":{"kind":"reference","name":"this"}}}
            ]}),
            "attributes":[{"name":"Note","args":[value_expr(json!("a note"))]}]
        }]
    }));
    let mut runtime = Runtime::metadata(graph.clone()).unwrap();
    runtime.run().unwrap();
    let note = graph.resolve_decorator(&url, "Note").unwrap();
    assert_eq!(
        serde_json::from_str::<Json>(&runtime.serialize_metadata(&note).unwrap().unwrap()).unwrap(),
        json!({"Note":{"note":"a note","of":"Note"}})
    );
    assert_eq!(
        serde_json::from_str::<Json>(
            &runtime
                .serialize_metadata(&graph.resolve(&url, "Main").unwrap())
                .unwrap()
                .unwrap()
        )
        .unwrap(),
        json!({"Note":{"note":"main","of":"Main"}})
    );

    let (graph, url) = compile_one(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [rule("Main", json!({"kind":"any"}))],
        "decorators": [
            {
                "name":"A",
                "pattern":{"kind":"end"},
                "expression": value_expr(json!("a")),
                "attributes":[{"name":"B","args":[]}]
            },
            {
                "name":"B",
                "pattern":{"kind":"end"},
                "expression": value_expr(json!("b")),
                "attributes":[{"name":"A","args":[]}]
            }
        ]
    }));
    let mut runtime = Runtime::metadata(graph.clone()).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        runtime
            .serialize_metadata(&graph.resolve_decorator(&url, "A").unwrap())
            .unwrap()
            .unwrap(),
        r#"{"B":"b"}"#
    );
    assert_eq!(
        runtime
            .serialize_metadata(&graph.resolve_decorator(&url, "B").unwrap())
            .unwrap()
            .unwrap(),
        r#"{"A":"a"}"#
    );
}

#[test]
// req:error-recovery-001 req:runtime-core-007
fn modport_run_module_execution_matches_default_named_and_recovered_rules() {
    let mut module = exported("Main");
    module["rules"] = json!([rule("Main", json!({"kind":"any"}))]);
    let runtime = execute_module(module, "x");
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Ok);
    assert_eq!(matched(&runtime), json!("x"));

    let mut named = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"One"}],
        "rules": [{
            "name":"One",
            "parameters":[],
            "pattern":{"kind":"any"},
            "expression":{"kind":"number","value":1}
        }]
    });
    let (graph, url) = compile_one(named.clone());
    let mut runtime =
        Runtime::with_mode(graph, &url, Some("One"), json!("x"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(matched(&runtime), json!(1));
    named["exports"][0]["default"] = json!(true);
    drop(named);

    let mut recovered = exported("Main");
    recovered["rules"] = json!([rule(
        "Main",
        json!({"kind":"then","patterns":[
            {"kind":"recover","pattern":equal("a"),"skip":{"kind":"any"}},
            {"kind":"end"}
        ]})
    )]);
    let runtime = execute_module(recovered, "x");
    let (kind, _, recovered_flag) = outcome(&runtime);
    assert_eq!(kind, crate::pattern::MatchKind::Ok);
    assert!(recovered_flag);
    assert!(!runtime.read(|execution| execution.is_clean()));
    assert_eq!(matched(&runtime), json!(["x", null]));
}

#[test]
// req:modules-runtime-001 req:project-file-002 req:modules-runtime-006 req:cli-bootstrap-004
fn modport_run_imports_resolve_through_maps_artifacts_and_packages() {
    let tokens = "jsr:@acme/kv@^1.2.0/tokens";
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@^1.2.0".into(),
        )]))
        .unwrap();
    let main = Url::parse("file:///uffda-execute/main.uff").unwrap();
    let token_url = Url::parse(tokens).unwrap();
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"@acme/kv/tokens","names":["T"]}],
                "exports":[{"kind":"rule","name":"Main","default":true}],
                "rules":[rule("Main", reference("T"))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    resolver.insert_declaration(
        token_url.clone(),
        decode_declaration(
            &token_url,
            &json!({
                "imports":[],
                "exports":[{"kind":"rule","name":"T"}],
                "rules":[rule("T", json!({"kind":"any"}))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let graph = Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&main).unwrap()).unwrap());
    let mut runtime =
        Runtime::with_mode(graph, &main, None, json!("x"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Ok);
    assert_eq!(matched(&runtime), json!("x"));

    let dir = TempDir::new("uffda-execute-layout");
    let out = dir.0.join("out");
    std::fs::create_dir_all(out.join("ast")).unwrap();
    std::fs::write(
        out.join("ast/dep.uffda.ast.json"),
        json!({
            "imports":[],
            "exports":[{"kind":"rule","name":"T"}],
            "rules":[rule("T", json!({"kind":"any"}))]
        })
        .to_string(),
    )
    .unwrap();
    let mut resolver = Resolver::new(dir.0.clone(), out).unwrap();
    let main = dir.url("main.uff");
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"./dep.uff","names":["T"]}],
                "exports":[{"kind":"rule","name":"Main","default":true}],
                "rules":[rule("Main", reference("T"))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let graph = Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&main).unwrap()).unwrap());
    let mut runtime =
        Runtime::with_mode(graph, &main, None, json!("x"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(matched(&runtime), json!("x"));

    let runtime = package_runtime("@acme/kv/tokens", &["T"]);
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Ok);
    assert_eq!(matched(&runtime), json!("x"));
}

#[test]
// req:modules-runtime-001 req:modules-runtime-003
fn modport_resolve_injected_declarations_skip_executable_loaders() {
    let dir = TempDir::new("uffda-resolve-ext");
    let mut resolver = Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
    let empty = r#"{"imports":[],"exports":[],"rules":[]}"#;
    for name in [
        "not-executed.ts",
        "not-executed.js",
        "not-executed.mjs",
        "not-executed.txt",
    ] {
        let url = dir.url(name);
        let before = resolver.declaration_count();
        let error = resolver.load_declaration(&url).unwrap_err();
        assert!(
            error.message.contains("unknown extension"),
            "{}",
            error.message
        );
        assert!(error.cause.is_none());
        assert_eq!(resolver.declaration_count(), before);
        resolver.insert_declaration(url.clone(), decode_declaration(&url, empty).unwrap());
        assert!(resolver.load_declaration(&url).unwrap().rules.is_empty());
        assert!(resolver.load_path(&url).is_err());
    }
}

#[test]
// req:modules-runtime-001 req:modules-runtime-002
fn modport_resolve_json_modules_cache_success_and_drop_failures() {
    let dir = TempDir::new("uffda-resolve-json");
    let path = dir.0.join("module.json");
    std::fs::write(
        &path,
        json!({
            "imports":[],
            "exports":[],
            "rules":[rule("A", json!({"kind":"any"})), rule("B", json!({"kind":"any"}))]
        })
        .to_string(),
    )
    .unwrap();
    let mut resolver = Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
    let url = dir.url("module.json");
    let graph = resolver.load_graph(&url).unwrap();
    let names: Vec<_> = graph.modules[&url].locals.keys().cloned().collect();
    assert_eq!(names, ["A", "B"]);
    assert!(Rc::ptr_eq(&graph, &resolver.load_graph(&url).unwrap()));
    assert_eq!(resolver.declaration_count(), 1);

    let bad = dir.url("bad.json");
    std::fs::write(dir.0.join("bad.json"), "{").unwrap();
    assert!(resolver.load_declaration(&bad).is_err());
    assert_eq!(resolver.declaration_count(), 1);
    assert!(resolver.load_declaration(&bad).is_err());
    std::fs::write(
        dir.0.join("bad.json"),
        r#"{"imports":[],"exports":[],"rules":[]}"#,
    )
    .unwrap();
    resolver.load_declaration(&bad).unwrap();
    assert_eq!(resolver.declaration_count(), 2);
}

#[test]
// req:modules-runtime-003
fn modport_resolve_native_imports_bind_one_declaration() {
    let dir = TempDir::new("uffda-resolve-native");
    let mut resolver = Resolver::new(dir.0.clone(), dir.0.join("bin")).unwrap();
    let leaf = json!({
        "imports":[],
        "exports":[{"kind":"rule","name":"A"},{"kind":"rule","name":"B"}],
        "rules":[rule("A", json!({"kind":"any"})), rule("B", json!({"kind":"any"}))]
    });
    let t0 = dir.url("test0.module.ts");
    let t1 = dir.url("test1.module.ts");
    let t2 = dir.url("test2.module.ts");
    resolver.insert_declaration(
        t0.clone(),
        decode_declaration(&t0, &leaf.to_string()).unwrap(),
    );
    resolver.insert_declaration(
        t1.clone(),
        decode_declaration(
            &t1,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"./test0.module.ts","names":["A"]}],
                "exports":[{"kind":"import","name":"A"}],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    resolver.insert_declaration(
        t2.clone(),
        decode_declaration(
            &t2,
            &json!({
                "imports":[{
                    "kind":"native",
                    "moduleUrl":"./test0.module.ts",
                    "names":["A"],
                    "module": leaf
                }],
                "exports":[],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let first = resolver.load_graph(&t1).unwrap();
    assert!(first.modules[&t1].locals.is_empty());
    assert_eq!(
        first.modules[&t1].imports["A"].module_url,
        first
            .modules
            .keys()
            .find(|url| url.path().ends_with("test0.module.ts"))
            .unwrap()
            .clone()
    );
    let second = resolver.load_graph(&t2).unwrap();
    let imported = second.modules[&t2].imports["A"].module_url.clone();
    assert!(Rc::ptr_eq(
        &first.modules[&t0].declaration,
        &second.modules[&imported].declaration,
    ));
    assert_eq!(
        second.modules[&imported]
            .locals
            .keys()
            .cloned()
            .collect::<Vec<_>>(),
        ["A", "B"]
    );
}

#[test]
// req:modules-runtime-005
fn modport_resolve_import_failure_keeps_the_edge_chain() {
    let main = Url::parse("file:///uffda-resolve10/main.uff").unwrap();
    let mid = Url::parse("file:///uffda-resolve10/mid.uff").unwrap();
    let leaf = Url::parse("file:///uffda-resolve10/leaf.uff").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    for (url, module) in [
        (
            &main,
            json!({
                "imports":[
                    {"kind":"module","moduleUrl":"./leaf.uff","names":["L"]},
                    {"kind":"module","moduleUrl":"./mid.uff","names":["M"]}
                ],
                "exports":[],
                "rules":[]
            }),
        ),
        (
            &mid,
            json!({
                "imports":[{"kind":"module","moduleUrl":"./leaf.uff","names":["Nope"]}],
                "exports":[{"kind":"rule","name":"M"}],
                "rules":[rule("M", json!({"kind":"any"}))]
            }),
        ),
        (
            &leaf,
            json!({
                "imports":[],
                "exports":[{"kind":"rule","name":"L"}],
                "rules":[rule("L", json!({"kind":"any"}))]
            }),
        ),
    ] {
        resolver.insert_declaration(
            url.clone(),
            decode_declaration(url, &module.to_string()).unwrap(),
        );
    }
    let error = must_fail_graph(resolver.load_graph(&main));
    assert_eq!(error.import_chain.len(), 2);
    assert_eq!(error.import_chain[0].importer_url, main.as_str());
    assert_eq!(error.import_chain[0].import_index, 1);
    assert_eq!(error.import_chain[0].module_url, "./mid.uff");
    assert_eq!(
        error.import_chain[0].resolved_url.as_deref(),
        Some(mid.as_str())
    );
    assert!(error.import_chain[0].name.is_none());
    assert_eq!(error.import_chain[1].importer_url, mid.as_str());
    assert_eq!(error.import_chain[1].import_index, 0);
    assert_eq!(error.import_chain[1].module_url, "./leaf.uff");
    assert_eq!(
        error.import_chain[1].resolved_url.as_deref(),
        Some(leaf.as_str())
    );
    assert_eq!(error.import_chain[1].name.as_deref(), Some("Nope"));
}

#[test]
// req:project-file-002 req:cli-bootstrap-004 req:modules-runtime-006
fn modport_resolve_import_map_artifacts_and_package_boundaries() {
    let main = Url::parse("file:///uffda-resolve11/main.uff").unwrap();
    let tokens = Url::parse("jsr:@acme/kv@^1.2.0/tokens").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@^1.2.0".into(),
        )]))
        .unwrap();
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"@acme/kv/tokens","names":["T"]}],
                "exports":[],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    resolver.insert_declaration(
        tokens.clone(),
        decode_declaration(
            &tokens,
            &json!({
                "imports":[],
                "exports":[{"kind":"rule","name":"T"}],
                "rules":[rule("T", json!({"kind":"any"}))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let graph = resolver.load_graph(&main).unwrap();
    assert!(graph.modules.contains_key(&tokens));

    let mut missing = Resolver::from_cwd().unwrap();
    missing
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@^1.2.0".into(),
        )]))
        .unwrap();
    missing.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"@acme/other","names":["T"]}],
                "exports":[],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let error = must_fail_graph(missing.load_graph(&main));
    assert!(
        error
            .message
            .contains("is not a module name the project file's imports declares"),
        "{}",
        error.message
    );
    assert_eq!(error.import_chain[0].module_url, "@acme/other");
    assert!(error.import_chain[0].resolved_url.is_none());

    let mut unpackaged = Resolver::from_cwd().unwrap();
    unpackaged
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@^1.2.0".into(),
        )]))
        .unwrap();
    unpackaged.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":"@acme/kv/tokens","names":["T"]}],
                "exports":[],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let error = must_fail_graph(unpackaged.load_graph(&main));
    assert!(
        error.message.contains("no package resolver is configured"),
        "{error}"
    );

    let dir = TempDir::new("uffda-resolve12");
    let out = dir.0.join("out");
    std::fs::create_dir_all(out.join("ast/lib")).unwrap();
    std::fs::write(
        out.join("ast/lib/dep.uffda.ast.json"),
        json!({
            "imports":[],
            "exports":[{"kind":"rule","name":"T"}],
            "rules":[rule("T", json!({"kind":"any"}))]
        })
        .to_string(),
    )
    .unwrap();
    let dep = dir.url("lib/dep.uff");
    let loaded = Resolver::new(dir.0.clone(), out)
        .unwrap()
        .load_graph(&dep)
        .unwrap();
    assert!(loaded.modules[&dep].locals.contains_key("T"));
    let outside = Resolver::from_cwd()
        .unwrap()
        .load_declaration(&dep)
        .unwrap_err();
    assert!(
        outside.message.contains("outside artifact root"),
        "{}",
        outside.message
    );

    let runtime = package_runtime("@acme/kv", &["KV"]);
    assert_eq!(matched(&runtime), json!("x"));
    let (graph, mut packages, _package_dir) = package_graph("@acme/kv/tokens", &["T"]);
    let tokens_url = graph
        .graph
        .modules
        .keys()
        .find(|url| url.path().ends_with("/tokens.uff"))
        .unwrap()
        .clone();
    let direct = packages
        .load_graph(&Url::parse("jsr:@acme/kv@1/tokens").unwrap())
        .unwrap();
    assert_eq!(direct.entry, tokens_url);
    assert!(Rc::ptr_eq(
        &graph.graph.modules[&tokens_url].declaration,
        &direct.modules[&tokens_url].declaration,
    ));

    let error = package_error("https://registry.test/@acme/kv/1.0.0/named.uff", &["N"]);
    assert!(
        error.message.contains("may not import"),
        "{}",
        error.message
    );
    let error = package_error("https://registry.test/@acme/kv/1.0.0/escape.uff", &["E"]);
    assert!(
        error.message.contains("is outside package @acme/kv@1.0.0"),
        "{}",
        error.message
    );
    let error = package_error("jsr:@acme/kv@^2", &["KV"]);
    assert!(error.to_string().contains("jsr:@acme/kv@^2"), "{error}");
}

fn package_runtime(module_url: &str, names: &[&str]) -> Runtime {
    let (graph, _resolver, _dir) = package_modules(module_url, names);
    let url = Url::parse("file:///uffda-resolve13/main.uff").unwrap();
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("x"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime
}

fn package_graph(module_url: &str, names: &[&str]) -> (Rc<CompiledModuleGraph>, Resolver, TempDir) {
    package_modules(module_url, names)
}

fn package_error(module_url: &str, names: &[&str]) -> crate::resolver::ModuleResolutionError {
    let dir = TempDir::new("uffda-resolve13-err");
    let (mut resolver, main) = package_resolver(&dir);
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":module_url,"names":names}],
                "exports":[],
                "rules":[]
            })
            .to_string(),
        )
        .unwrap(),
    );
    must_fail_graph(resolver.load_graph(&main))
}

fn package_modules(
    module_url: &str,
    names: &[&str],
) -> (Rc<CompiledModuleGraph>, Resolver, TempDir) {
    let dir = TempDir::new("uffda-resolve13");
    let (mut resolver, main) = package_resolver(&dir);
    resolver.insert_declaration(
        main.clone(),
        decode_declaration(
            &main,
            &json!({
                "imports":[{"kind":"module","moduleUrl":module_url,"names":names}],
                "exports":[{"kind":"rule","name":"Main","default":true}],
                "rules":[rule("Main", reference(names[0]))]
            })
            .to_string(),
        )
        .unwrap(),
    );
    let graph = Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&main).unwrap()).unwrap());
    (graph, resolver, dir)
}

fn package_resolver(dir: &TempDir) -> (Resolver, Url) {
    let fake = Rc::new(FakeTransport::default());
    fake.files.borrow_mut().insert(
        "/@acme/kv/meta.json".into(),
        json!({"versions":{"1.0.0":{}}}).to_string().into_bytes(),
    );
    publish_version(
        &fake,
        "1.0.0",
        r#"{"exports":{".":"./kv.uff","./tokens":"./tokens.uff"}}"#,
        &[
            (
                "bin/ast/kv.uffda.ast.json",
                declaration(
                    "KV",
                    json!([{"kind":"module","moduleUrl":"./tokens.uff","names":["T"]}]),
                ),
            ),
            ("bin/ast/tokens.uffda.ast.json", declaration("T", json!([]))),
            (
                "bin/ast/named.uffda.ast.json",
                declaration(
                    "N",
                    json!([{"kind":"module","moduleUrl":"@acme/kv/tokens","names":["T"]}]),
                ),
            ),
            (
                "bin/ast/escape.uffda.ast.json",
                declaration(
                    "E",
                    json!([{"kind":"module","moduleUrl":"../../@acme/other/1.0.0/x.uff","names":["X"]}]),
                ),
            ),
        ],
    );
    let transport: Rc<dyn Transport> = fake;
    let packages = JsrPackages::new(
        Url::parse("https://registry.test/").unwrap(),
        dir.0.clone(),
        transport,
        Lockfile::memory(),
    )
    .unwrap();
    let mut resolver = Resolver::new(dir.0.clone(), dir.0.join("unused")).unwrap();
    resolver
        .set_import_map(BTreeMap::from([(
            "@acme/kv".into(),
            "jsr:@acme/kv@^1.0.0".into(),
        )]))
        .unwrap();
    resolver.set_packages(packages);
    (
        resolver,
        Url::parse("file:///uffda-resolve13/main.uff").unwrap(),
    )
}

#[test]
// req:direct-left-recursion-001
fn modport_rule_direct_left_recursion_stabilizes_or_stops_early() {
    let runtime = execute_module(
        {
            let mut module = exported("R");
            module["rules"] = json!([rule("R", equal("a"))]);
            module
        },
        "a",
    );
    assert_eq!(outcome(&runtime), (crate::pattern::MatchKind::Ok, 1, false));
    assert_eq!(matched(&runtime), json!("a"));

    let mut module = exported("a");
    module["rules"] = json!([rule(
        "a",
        json!({"kind":"or","patterns":[reference("a"), equal("a")]})
    )]);
    let runtime = execute_module(module, "aa");
    assert_eq!(outcome(&runtime), (crate::pattern::MatchKind::Ok, 1, false));
    assert_eq!(matched(&runtime), json!("a"));

    let mut module = exported("a");
    module["rules"] = json!([rule(
        "a",
        json!({"kind":"or","patterns":[
            {"kind":"then","patterns":[reference("a"), equal("a")]},
            equal("a")
        ]})
    )]);
    let runtime = execute_module(module, "aaa");
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Ok);
    assert_eq!(outcome(&runtime).1, 3);
    assert_eq!(matched(&runtime), json!([["a", "a"], "a"]));

    let mut module = exported("a");
    module["rules"] = json!([rule(
        "a",
        json!({"kind":"or","patterns":[
            {"kind":"then","patterns":[equal("a"), reference("a")]},
            equal("a")
        ]})
    )]);
    let runtime = execute_module(module, "aaa");
    assert_eq!(matched(&runtime), json!(["a", ["a", "a"]]));

    let mut module = exported("b");
    module["exports"] = json!([
        {"kind":"rule","name":"a"},
        {"kind":"rule","name":"b","default":true}
    ]);
    module["rules"] = json!([rule("a", reference("b")), rule("b", reference("a"))]);
    let runtime = execute_module(module, "ab");
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Fail);
}

#[test]
// req:runtime-core-010
fn modport_rule_declared_rules_do_not_see_caller_variables() {
    let mut module = exported("P1");
    module["exports"] = json!([
        {"kind":"rule","name":"P0"},
        {"kind":"rule","name":"P1","default":true}
    ]);
    module["rules"] = json!([
        {
            "name":"P0",
            "parameters":[],
            "pattern":{"kind":"any"},
            "expression":{"kind":"boolean","value":true}
        },
        rule(
            "P1",
            json!({"kind":"then","patterns":[
                {"kind":"variable","name":"x","pattern":{"kind":"any"}},
                {"kind":"or","patterns":[reference("P0"), {"kind":"any"}]}
            ]})
        )
    ]);
    let runtime = execute_module(module, "ab");
    assert_eq!(matched(&runtime), json!(["a", true]));

    let (graph, url) = compile_one({
        let mut module = exported("P1");
        module["rules"] = json!([
            {
                "name":"P0",
                "parameters":[],
                "pattern":{"kind":"any"},
                "expression":{"kind":"reference","name":"x"}
            },
            rule(
                "P1",
                json!({"kind":"then","patterns":[
                    {"kind":"variable","name":"x","pattern":{"kind":"any"}},
                    reference("P0")
                ]})
            )
        ]);
        module["exports"] = json!([
            {"kind":"rule","name":"P0"},
            {"kind":"rule","name":"P1","default":true}
        ]);
        module
    });
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("ab"), InputMode::Iterable).unwrap();
    let error = runtime.run().unwrap_err();
    assert!(
        error.to_string().contains("unknown reference: x"),
        "{error}"
    );

    let mut module = exported("P1");
    module["rules"] = json!([
        {
            "name":"P0",
            "parameters":[],
            "pattern":{"kind":"variable","name":"x","pattern":{"kind":"any"}},
            "expression":{"kind":"reference","name":"x"}
        },
        {
            "name":"P1",
            "parameters":[],
            "pattern": reference("P0"),
            "expression":{"kind":"reference","name":"_"}
        }
    ]);
    assert_eq!(matched(&execute_module(module, "a")), json!("a"));

    let caller = "file:///rule07/m1.json";
    let runtime = execute_files(
        &[
            (
                caller,
                json!({
                    "imports":[{"kind":"module","moduleUrl":"./m0.json","names":["P0"]}],
                    "exports":[{"kind":"rule","name":"P1","default":true}],
                    "rules":[rule(
                        "P1",
                        json!({"kind":"then","patterns":[
                            {"kind":"variable","name":"x","pattern":{"kind":"any"}},
                            {"kind":"or","patterns":[reference("P0"), {"kind":"any"}]}
                        ]})
                    )]
                }),
            ),
            (
                "file:///rule07/m0.json",
                json!({
                    "imports":[],
                    "exports":[{"kind":"rule","name":"P0"}],
                    "rules":[{
                        "name":"P0",
                        "parameters":[],
                        "pattern":{"kind":"any"},
                        "expression":{"kind":"boolean","value":true}
                    }]
                }),
            ),
        ],
        "ab",
    );
    assert_eq!(matched(&runtime), json!(["a", true]));
}

#[test]
// req:runtime-core-007 req:expressions-runtime-005
fn modport_rule_projection_replaces_the_match_and_reports_expression_errors() {
    let mut module = exported("P0");
    module["rules"] = json!([{
        "name":"P0",
        "parameters":[],
        "pattern":{"kind":"any"},
        "expression": value_expr(json!("b"))
    }]);
    assert_eq!(matched(&execute_module(module, "a")), json!("b"));

    let (graph, url) = compile_one({
        let mut module = exported("P0");
        module["rules"] = json!([{
            "name":"P0",
            "parameters":[],
            "pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"missing"}
        }]);
        module
    });
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("a"), InputMode::Iterable).unwrap();
    let error = runtime.run().unwrap_err();
    assert!(
        error.to_string().contains("unknown reference: missing"),
        "{error}"
    );
    assert_eq!(
        runtime.read(|execution| execution.error_context().unwrap().rule_name.clone()),
        "P0"
    );
    assert_eq!(
        runtime.read(|execution| execution.error_context().unwrap().entered_at),
        0
    );

    let (graph, url) = compile_one({
        let mut module = exported("P0");
        module["rules"] = json!([{
            "name":"P0",
            "parameters":[],
            "pattern":{"kind":"any"},
            "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},"args":[]}
        }]);
        module
    });
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!("a"),
        InputMode::Iterable,
        vec![HostCallable {
            id: 1,
            name: "host".into(),
            arity: 0,
        }],
    )
    .unwrap();
    let error =
        drive_now(runtime.drive(|_, _| std::future::ready(Err("boom".into())))).unwrap_err();
    assert!(error.to_string().contains("boom"), "{error}");
}

#[test]
// req:rules-001
fn modport_rule_memo_reuses_the_projected_value() {
    let mut module = exported("Main");
    module["rules"] = json!([
        {
            "name":"R",
            "parameters":[],
            "pattern": equal("a"),
            "expression": value_expr(json!("projected"))
        },
        rule(
            "Main",
            json!({"kind":"or","patterns":[
                {"kind":"then","patterns":[reference("R"), equal("x")]},
                reference("R")
            ]})
        )
    ]);
    let runtime = execute_module(module, "a");
    assert_eq!(matched(&runtime), json!("projected"));
    assert!(runtime.read(|execution| execution.memo_hits() > 0));
}

#[test]
// req:indirect-left-recursion-001
fn modport_rule_indirect_growth_marks_involved_outcomes_seeded() {
    let mut module = exported("E");
    module["rules"] = json!([
        rule("E", reference("T")),
        rule(
            "T",
            json!({"kind":"or","patterns":[
                {"kind":"then","patterns":[reference("E"), equal("+"), equal("n")]},
                equal("n")
            ]})
        )
    ]);
    let runtime = execute_module(module, "n+n");
    assert_eq!(matched(&runtime), json!(["n", "+", "n"]));
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        let mut head = None;
        let mut involved = Vec::new();
        each_match(result, |node| match rule_name(&node).as_deref() {
            Some("E") => head = Some(node.seeded),
            Some("T") => involved.push(node.seeded),
            _ => {}
        });
        assert_eq!(head, Some(false));
        assert!(!involved.is_empty());
        let mut saw_seed = false;
        each_match(result, |node| {
            saw_seed |= node.seeded
                && node.kind == crate::pattern::MatchKind::Fail
                && node.children.is_empty();
        });
        assert!(saw_seed);
    });
}

#[test]
// req:indirect-left-recursion-003
fn modport_rule_failed_head_keeps_partial_progress() {
    let mut module = exported("A");
    module["rules"] = json!([rule(
        "A",
        json!({"kind":"or","patterns":[
            {"kind":"then","patterns":[reference("A"), equal("x")]},
            {"kind":"then","patterns":[equal("a"), equal("b"), equal("c")]}
        ]})
    )]);
    let runtime = execute_module(module, "ab");
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Fail);
    runtime.read(|execution| {
        let failure = execution.failure_match().unwrap();
        assert_eq!(failure.start, 2);
    });
}

#[test]
// req:direct-left-recursion-001 req:indirect-left-recursion-003
fn modport_rule_growth_retains_the_seed_and_the_ending_attempt() {
    let mut module = exported("A");
    module["rules"] = json!([rule(
        "A",
        json!({"kind":"or","patterns":[
            {"kind":"then","patterns":[reference("A"), equal("x")]},
            equal("a")
        ]})
    )]);
    let runtime = execute_module(module, "ay");
    assert_eq!(outcome(&runtime).0, crate::pattern::MatchKind::Ok);
    runtime.read(|execution| {
        let mut seed = false;
        let mut rejected_x = false;
        each_match(execution.result().unwrap(), |node| {
            if node.kind == crate::pattern::MatchKind::Fail
                && node.children.is_empty()
                && node.seeded
                && node.pattern_kind == PatternKind::Fail
            {
                seed = true;
            }
            if node.kind == crate::pattern::MatchKind::Fail
                && node.pattern_kind == PatternKind::Equal
                && node.start == 1
            {
                rejected_x = true;
            }
        });
        assert!(seed);
        assert!(rejected_x);
    });
}

#[test]
// req:direct-left-recursion-001
fn modport_rule_projection_applies_once_per_growth_step() {
    let mut module = exported("R");
    module["rules"] = json!([{
        "name":"R",
        "parameters":[],
        "pattern":{"kind":"then","patterns":[
            {"kind":"variable","name":"e","pattern":{"kind":"or","patterns":[reference("R"), equal("a")]}},
            equal("."),
            {"kind":"variable","name":"n","pattern":{"kind":"any"}}
        ]},
        "expression":{"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"reference","name":"e"}},
            {"kind":"arrayElement","expression":{"kind":"reference","name":"n"}}
        ]}
    }]);
    let runtime = execute_module(module, "a.b.c");
    assert_eq!(matched(&runtime), json!([["a", "b"], "c"]));
    assert!(runtime.read(|execution| execution.body_attempts() >= 2));
}

#[test]
// req:error-recovery-005
fn modport_rule_origin_records_the_recovery_setting() {
    let module = json!({
        "imports": [],
        "exports": [],
        "rules": [
            rule(
                "Memoized",
                json!({"kind":"or","patterns":[
                    equal("a"),
                    {"kind":"then","patterns":[{"kind":"fail"}, reference("Memoized")]}
                ]})
            ),
            rule("Leaf", equal("a"))
        ]
    });
    for name in ["Memoized", "Leaf"] {
        for recovery in [false, true] {
            let (graph, url) = compile_one(module.clone());
            let member = graph.resolve(&url, name).unwrap();
            let mut runtime =
                Runtime::for_member(graph, &member, json!("a"), InputMode::Iterable).unwrap();
            if recovery {
                runtime.arena.mutate_root(|mc, execution| {
                    let enabled = execution.entry.recovery.enable();
                    execution.entry.recovery = enabled;
                    execution.frames[0].execution =
                        Execution::Pattern(PatternExecution::new_with_recovery(
                            mc,
                            Pattern::Resolve {
                                target_kind: ResolveTargetKind::Reference,
                                name: Some(name.into()),
                                args: vec![],
                                value: None,
                            },
                            execution.entry.input.clone(),
                            execution.entry.environment,
                            enabled,
                        ));
                });
            }
            runtime.run().unwrap();
            runtime.read(|execution| {
                let result = execution.result().unwrap();
                assert_eq!(result.kind, crate::pattern::MatchKind::Ok);
                let mut recorded = None;
                each_match(result, |node| {
                    if rule_name(&node).as_deref() == Some(name) {
                        recorded = Some(node.recovery.is_enabled());
                    }
                });
                assert_eq!(recorded, Some(recovery));
            });
        }
    }
}

#[test]
// req:runtime-core-007
fn modport_rule_fresh_invocation_completes_with_the_match() {
    let mut module = exported("Any");
    module["rules"] = json!([rule("Any", json!({"kind":"any"}))]);
    let runtime = execute_module(module, "a");
    assert_eq!(outcome(&runtime), (crate::pattern::MatchKind::Ok, 1, false));
    assert_eq!(runtime.read(|execution| execution.error().is_none()), true);
}

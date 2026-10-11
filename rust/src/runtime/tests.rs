use super::*;
use crate::resolver::{Resolver, decode_declaration};
use serde_json::{Value as Json, json};

fn graph(rules: Json, entry: &str) -> (Rc<CompiledModuleGraph>, Url) {
    module_graph(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":entry,"default":true}],
        "rules": rules,
        "funcs": [],
        "decorators": []
    }))
}

fn module_graph(module: Json) -> (Rc<CompiledModuleGraph>, Url) {
    let url = Url::parse("file:///runtime-test.json").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(&url, &module.to_string()).unwrap(),
    );
    let graph = resolver.load_graph(&url).unwrap();
    (Rc::new(CompiledModuleGraph::compile(graph).unwrap()), url)
}

fn rule(name: &str, pattern: Json) -> Json {
    json!({"name":name,"parameters":[],"pattern":pattern})
}

fn reference(name: &str) -> Json {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":[]})
}

fn equal(value: Json) -> Json {
    json!({"kind":"equal","value":{"kind":"value.literal","value":value}})
}

fn text_runtime(rules: Json, entry: &str, input: &str) -> Runtime {
    let (graph, url) = graph(rules, entry);
    Runtime::with_mode(graph, &url, None, json!(input), InputMode::Iterable).unwrap()
}

fn host() -> HostCallable {
    HostCallable {
        id: 31,
        name: "host".into(),
        arity: 1,
    }
}

fn host_call(argument: Json) -> Json {
    json!({"kind":"invocation","expression":{"kind":"reference","name":"host"},"args":[argument]})
}

#[derive(Default)]
struct HostWake(std::sync::atomic::AtomicUsize);
impl std::task::Wake for HostWake {
    fn wake(self: std::sync::Arc<Self>) {
        self.wake_by_ref();
    }
    fn wake_by_ref(self: &std::sync::Arc<Self>) {
        self.0.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
}

struct DelayedHost {
    pending: bool,
    result: Option<Result<HostCompletion, String>>,
}
impl Future for DelayedHost {
    type Output = Result<HostCompletion, String>;
    fn poll(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        if self.pending {
            self.pending = false;
            cx.waker().wake_by_ref();
            std::task::Poll::Pending
        } else {
            std::task::Poll::Ready(self.result.take().unwrap())
        }
    }
}

fn drive_bounded<F: Future>(future: F) -> F::Output {
    let wakes = std::sync::Arc::new(HostWake::default());
    let waker = std::task::Waker::from(wakes.clone());
    let mut cx = std::task::Context::from_waker(&waker);
    let mut future = Box::pin(future);
    for _ in 0..10_000 {
        let before = wakes.0.load(std::sync::atomic::Ordering::SeqCst);
        match future.as_mut().poll(&mut cx) {
            std::task::Poll::Ready(result) => return result,
            std::task::Poll::Pending => {
                assert!(wakes.0.load(std::sync::atomic::Ordering::SeqCst) > before)
            }
        }
    }
    panic!("host driver exceeded bounded polls");
}

#[test]
// req:runtime-core-013 req:runtime-memory-005
fn rule_projection_suspends_authored_function_and_reuses_completed_memo() {
    let (graph, url) = module_graph(json!({
        "imports": [], "exports":[{"kind":"rule","name":"Main","default":true}], "decorators":[],
        "rules":[rule("Main", json!({"kind":"and","patterns":[reference("Child"),reference("Child")]})),
            rule("Child", json!({"kind":"projection","pattern":{"kind":"any"},
                "expression":{"kind":"invocation","expression":{"kind":"reference","name":"Call"},"args":[]}}))],
        "funcs":[{"name":"Call","pattern":{"kind":"end"},
            "expression":host_call(json!({"kind":"value","value":{"retained":[1,2,3]}}))}]
    }));
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!("a"),
        InputMode::Iterable,
        vec![host()],
    )
    .unwrap();
    let mut calls = 0;
    let mut retained = None;
    drive_bounded(runtime.drive(|runtime, request| {
        calls += 1;
        assert_eq!(request.callable, host());
        runtime.collect_all();
        assert_eq!(
            runtime
                .read_rooted(&request.arguments[0], |v| v.runtime_type())
                .unwrap(),
            crate::value::RuntimeType::Object
        );
        retained = Some(request.arguments[0].clone());
        runtime.read(|execution| {
            assert!(
                execution
                    .memos
                    .iter()
                    .any(|memo| matches!(memo.state, MemoState::Pending))
            )
        });
        DelayedHost {
            pending: true,
            result: Some(Ok(HostCompletion::Rooted(request.arguments[0].clone()))),
        }
    }))
    .unwrap();
    assert_eq!(calls, 1);
    runtime.collect_all();
    assert_eq!(
        runtime
            .read_rooted(&retained.unwrap(), |v| v.runtime_type())
            .unwrap(),
        crate::value::RuntimeType::Object
    );
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(execution.memo_hits() > 0);
        assert!(
            !execution
                .memos
                .iter()
                .any(|memo| matches!(memo.state, MemoState::Pending | MemoState::Growing(_)))
        );
    });
}

#[test]
// req:runtime-core-013 req:runtime-core-007
fn pipeline_drains_suspended_host_iterator_callbacks_sequentially() {
    let (graph, url) = graph(
        json!([rule(
            "Main",
            json!({"kind":"pipeline","steps":[
                {"kind":"projection","pattern":{"kind":"ok"},"expression":{
                    "kind":"invocation","expression":{"kind":"reference","name":"map"},
                    "args":[{"kind":"value","value":[1,2,3]},{"kind":"reference","name":"host"}]}},
                {"kind":"into","pattern":{"kind":"quantifier","pattern":{"kind":"any"}}}
            ]})
        )]),
        "Main",
    );
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!(null),
        InputMode::Empty,
        vec![host()],
    )
    .unwrap();
    let mut seen = vec![];
    drive_bounded(runtime.drive(|runtime, request| {
        runtime.collect_all();
        seen.push(
            runtime
                .read_rooted(&request.arguments[0], |v| {
                    let Value::Number(n) = v else {
                        panic!("expected number")
                    };
                    n
                })
                .unwrap(),
        );
        DelayedHost {
            pending: true,
            result: Some(Ok(HostCompletion::Rooted(request.arguments[0].clone()))),
        }
    }))
    .unwrap();
    assert_eq!(seen, [1.0, 2.0, 3.0]);
    runtime.read(|execution| assert_eq!(execution.result().unwrap().kind, MatchKind::Ok));
}

#[test]
// req:runtime-core-013 req:runtime-memory-005
fn into_drains_host_next_methods_and_surfaces_only_host_requests() {
    let pattern = Pattern::Into {
        pattern: Box::new(Pattern::Quantifier {
            pattern: Box::new(Pattern::Any),
            min: None,
            max: None,
        }),
    };
    let mut runtime = Runtime::for_pattern_with_environment(pattern, |mc| {
        let source = Value::object(mc, vec![]);
        let Value::Object(object) = source else {
            unreachable!()
        };
        object
            .borrow_mut(mc)
            .set_symbol("iterator".into(), Value::host(mc, host()));
        (vec![source], Environment::new(mc, None, vec![]))
    });
    let mut calls = 0;
    drive_bounded(runtime.drive(|runtime, _request| {
        runtime.collect_all();
        assert!(runtime.read(|execution| {
            execution
                .frames
                .last()
                .unwrap()
                .execution
                .request()
                .is_none()
        }));
        calls += 1;
        let completion = if calls == 1 {
            HostCompletion::materialize(vec![], |mc, _| {
                Ok(Value::object(
                    mc,
                    vec![("next".into(), Value::host(mc, host()))],
                ))
            })
        } else {
            let done = calls == 4;
            HostCompletion::materialize(vec![], move |mc, _| {
                Ok(Value::object(
                    mc,
                    vec![
                        ("done".into(), Value::Boolean(done)),
                        ("value".into(), Value::Number(42.0)),
                    ],
                ))
            })
        };
        DelayedHost {
            pending: true,
            result: Some(Ok(completion)),
        }
    }))
    .unwrap();
    assert_eq!(calls, 4);
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        let Value::Array(values) = result.value.raw() else {
            panic!("expected collected values")
        };
        assert_eq!(values.borrow().len(), 2);
    });
}

#[test]
// req:runtime-core-013
fn runtime_host_errors_and_cancellation_release_frames_and_pending_memo_dependencies() {
    let make = || {
        let (graph, url) = graph(
            json!([rule(
                "Main",
                json!({
                    "kind":"projection","pattern":{"kind":"any"},"expression":host_call(json!({"kind":"reference","name":"_"}))
                })
            )]),
            "Main",
        );
        Runtime::with_hosts(
            graph,
            &url,
            None,
            json!({"retained":[1]}),
            InputMode::Scalar,
            vec![host()],
        )
        .unwrap()
    };
    let mut runtime = make();
    let error = drive_bounded(runtime.drive(|_, _| DelayedHost {
        pending: true,
        result: Some(Err("host unavailable".into())),
    }))
    .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("host invocation failed: host unavailable")
    );
    assert_eq!(runtime.step_status().unwrap_err(), error);
    runtime.collect_all();
    runtime.read(|execution| {
        assert!(execution.frames.is_empty());
        assert!(execution.initialization.is_none());
        assert!(!execution.memos.iter().any(|memo| matches!(
            memo.state,
            MemoState::Pending | MemoState::Growing(_)
        ) || !memo.dependencies.is_empty()
            || !memo.seed_dependencies.is_empty()));
        assert_eq!(execution.error_context().unwrap().rule_name, "Main");
    });
    let mut runtime = make();
    let future_lifetime = Rc::new(());
    let weak = Rc::downgrade(&future_lifetime);
    let waker = std::task::Waker::from(std::sync::Arc::new(HostWake::default()));
    let mut driver = Box::pin(runtime.drive(move |_, request| {
        let guard = future_lifetime.clone();
        async move {
            let _keep = (guard, request);
            std::future::pending::<Result<HostCompletion, String>>().await
        }
    }));
    assert!(
        driver
            .as_mut()
            .poll(&mut std::task::Context::from_waker(&waker))
            .is_pending()
    );
    drop(driver);
    assert!(weak.upgrade().is_none());
    assert_eq!(
        runtime.step_status().unwrap_err(),
        RuntimeError::Expression(EvaluationError::Cancelled)
    );
    runtime.read(|execution| {
        assert!(execution.frames.is_empty());
        assert!(execution.memos.is_empty());
        assert!(execution.memo_keys.is_empty());
    });
}

fn pending_runtime_request(runtime: &mut Runtime) -> HostRequest {
    for _ in 0..1000 {
        match runtime.step_status().unwrap() {
            StepStatus::Suspended => return runtime.take_host_request().expect("pending host"),
            StepStatus::Yielded => runtime.collect_all(),
            StepStatus::Complete => panic!("host did not suspend"),
        }
    }
    panic!("bounded host suspension exceeded");
}

#[test]
// req:runtime-core-013 req:runtime-memory-004
fn runtime_rejects_foreign_and_stale_child_completions_without_advancing_other_children() {
    let make = || {
        let (graph, url) = graph(
            json!([rule(
                "Main",
                json!({"kind":"projection",
                    "pattern":{"kind":"any"}, "expression":host_call(json!({"kind":"reference","name":"_"}))
                })
            )]),
            "Main",
        );
        Runtime::with_hosts(
            graph,
            &url,
            None,
            json!([1, 2]),
            InputMode::Scalar,
            vec![host()],
        )
        .unwrap()
    };
    let mut left = make();
    let mut right = make();
    let left_request = pending_runtime_request(&mut left);
    let right_request = pending_runtime_request(&mut right);
    let error = left
        .complete_host(&right_request, Err("wrong owner".into()))
        .unwrap_err();
    assert!(runtime_stale_request(&error));
    assert_eq!(left.step_status().unwrap(), StepStatus::Suspended);
    assert_eq!(right.step_status().unwrap(), StepStatus::Suspended);
    assert!(
        right
            .read_rooted(&left_request.arguments[0], |_| ())
            .is_err()
    );
    left.complete_host(
        &left_request,
        Ok(HostCompletion::Rooted(left_request.arguments[0].clone())),
    )
    .unwrap();
    left.run().unwrap();
    let error = left
        .complete_host(&left_request, Err("completed".into()))
        .unwrap_err();
    assert!(runtime_stale_request(&error));
    assert_eq!(left.step_status().unwrap(), StepStatus::Complete);
    let error = right
        .complete_host(
            &right_request,
            Ok(HostCompletion::materialize(
                vec![left_request.arguments[0].clone()],
                |_, _| panic!("foreign materializer must not run"),
            )),
        )
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("value belongs to another runtime")
    );
    assert_eq!(right.step_status().unwrap_err(), error);
    right.read(|execution| assert!(execution.frames.is_empty()));
}

#[test]
// req:runtime-core-013 req:rule-decorators-003
fn host_driver_services_attribute_argument_and_decorator_frames_before_rule_body() {
    let (graph, url) = module_graph(json!({
        "imports": [], "exports":[{"kind":"rule","name":"Main","default":true}], "funcs":[],
        "rules":[{"name":"Main","parameters":[],"pattern":{"kind":"any"},
            "attributes":[{"name":"Label","args":[host_call(json!({"kind":"value","value":"argument"}))]}]}],
        "decorators":[{"name":"Label","pattern":{"kind":"any"},
            "expression":host_call(json!({"kind":"reference","name":"_"}))}]
    }));
    let member = graph.resolve(&url, "Main").unwrap();
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!("a"),
        InputMode::Iterable,
        vec![host()],
    )
    .unwrap();
    let mut count = 0;
    drive_bounded(runtime.drive(|runtime, request| {
        runtime.collect_all();
        assert_eq!(runtime.read(|execution| execution.body_attempts()), 0);
        count += 1;
        DelayedHost {
            pending: true,
            result: Some(Ok(HostCompletion::Rooted(request.arguments[0].clone()))),
        }
    }))
    .unwrap();
    assert_eq!(count, 2);
    assert_eq!(
        runtime.serialize_metadata(&member).unwrap(),
        Some(r#"{"Label":"argument"}"#.into())
    );
    runtime.read(|execution| assert_eq!(execution.result().unwrap().kind, MatchKind::Ok));
}

#[test]
// req:rule-decorators-003 req:rule-decorators-004 req:rule-decorators-006
fn metadata_initialization_requires_neither_default_export_nor_executing_a_body() {
    let (graph, url) = module_graph(json!({
        "imports": [], "exports": [], "funcs": [],
        "rules": [{
            "name":"Main","parameters":[],"pattern":reference("missing"),
            "attributes":[{"name":"Describe","args":[]}]
        }],
        "decorators":[{"name":"Describe","pattern":{"kind":"end"},
            "expression":{"kind":"member","expression":{"kind":"reference","name":"this"},"name":"name"}}]
    }));
    let member = graph.resolve(&url, "Main").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }

    runtime.read(|execution| {
        assert!(execution.result().is_none());
        assert_eq!(execution.body_attempts(), 0);
    });
    assert_eq!(
        runtime.serialize_metadata(&member).unwrap(),
        Some(r#"{"Describe":"Main"}"#.into())
    );
    runtime.collect_all();
    assert_eq!(
        runtime.serialize_metadata(&member).unwrap(),
        Some(r#"{"Describe":"Main"}"#.into())
    );
}

#[test]
// req:rule-decorators-003 req:rule-decorators-004
fn callable_only_modules_initialize_attributes_without_invoking_functions() {
    let (graph, url) = module_graph(json!({
        "imports": [], "exports": [], "rules": [],
        "funcs":[{"name":"F","pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"missing"},
            "attributes":[{"name":"Marker","args":[]}]}],
        "decorators":[{"name":"Marker","pattern":{"kind":"end"},
            "expression":{"kind":"value","value":null}}]
    }));
    let member = graph.resolve(&url, "F").unwrap();
    let mut runtime = Runtime::metadata(graph).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        runtime.serialize_metadata(&member).unwrap(),
        Some(r#"{"Marker":null}"#.into())
    );
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn result_serialization_preserves_the_rooted_raw_tree_and_is_repeatable() {
    let mut main = rule("Main", equal(json!("x")));
    main["expression"] = json!({"kind":"value","value":{"items":[1,null,"x"]}});
    let mut runtime = text_runtime(json!([main]), "Main", "x");
    runtime.run().unwrap();
    runtime.collect_all();
    let expected = Some(r#"{"items":[1,null,"x"]}"#.into());
    assert_eq!(runtime.serialize_result().unwrap(), expected);
    runtime.collect_all();
    runtime.read(|execution| {
        let matched = execution.result().unwrap();
        assert_eq!(matched.kind, MatchKind::Ok);
        assert_eq!(matched.end, 1);
        assert!(matches!(matched.value.raw(), Value::Object(_)));
        assert!(!matched.children.is_empty());
    });
    assert_eq!(runtime.serialize_result().unwrap(), expected);
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn undefined_result_serialization_does_not_fabricate_json_null() {
    let mut main = rule("Main", json!({"kind":"ok"}));
    main["expression"] = json!({"kind":"value"});
    let mut runtime = text_runtime(json!([main]), "Main", "");
    runtime.run().unwrap();
    assert_eq!(runtime.serialize_result().unwrap(), None);
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn serializer_services_native_hooks_in_the_retained_runtime_arena() {
    let mut runtime = text_runtime(json!([rule("Main", equal(json!("x")))]), "Main", "x");
    runtime.run().unwrap();
    runtime.arena.mutate_root(|mc, execution| {
        let result = execution.result().unwrap();
        let value = Value::object(
            mc,
            vec![(
                "toJSON".into(),
                Value::Native(crate::globals::NativeGlobal::Id),
            )],
        );
        execution
            .begin_serialize(mc, value, result.environment, result.origin)
            .unwrap();
    });
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }
    runtime.read(|execution| {
        assert_eq!(execution.serialized_json().unwrap(), Some(r#""""#.into()));
        assert_eq!(execution.result().unwrap().end, 1);
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn serialization_failure_retains_the_original_match_and_error() {
    let mut runtime = text_runtime(json!([rule("Main", equal(json!("x")))]), "Main", "x");
    runtime.run().unwrap();
    runtime.arena.mutate_root(|mc, execution| {
        let matched = execution.result().unwrap();
        let value = Value::object(mc, vec![]);
        let Value::Object(object) = value else {
            unreachable!()
        };
        object.borrow_mut(mc).set("self".into(), value);
        execution
            .begin_serialize(mc, value, matched.environment, matched.origin)
            .unwrap();
    });
    let error = runtime.run().unwrap_err();
    runtime.collect_all();
    assert_eq!(runtime.step().unwrap_err(), error);
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(execution.result().unwrap().end, 1);
    });
}

#[test]
// req:runtime-core-004 req:cli-bootstrap-024
fn published_source_pipeline_preserves_all_input_units() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    let url = root.join("src/lang/source/mod.uff").unwrap();
    let graph = resolver.load_graph(&url).unwrap();
    let graph = Rc::new(CompiledModuleGraph::compile(graph).unwrap());
    let mut runtime = Runtime::new(graph, &url, Some("NormalizedText"), json!("42")).unwrap();
    runtime.run().unwrap();
    let text = runtime.serialize_result().unwrap().unwrap();
    let value: Json = serde_json::from_str(&text).unwrap();
    assert_eq!(value["text"], "42", "{value}");
}

#[test]
// req:runtime-core-004 req:cli-bootstrap-024
fn published_number_rule_consumes_every_nested_digit() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    let url = root.join("src/lang/expression/number.uff").unwrap();
    let graph = resolver.load_graph(&url).unwrap();
    let graph = Rc::new(CompiledModuleGraph::compile(graph).unwrap());
    let mut runtime = Runtime::new(graph, &url, Some("Number"), json!("42")).unwrap();
    runtime.run().unwrap();
    let text = runtime.serialize_result().unwrap().unwrap();
    let value: Json = serde_json::from_str(&text).unwrap();
    assert_eq!(value["value"], 42, "{value}");
}

#[test]
// req:runtime-core-004 req:cli-bootstrap-024
fn published_tokenizer_preserves_multicharacter_word_tokens() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    let url = root.join("src/lang/tokenizer/mod.uff").unwrap();
    let graph = resolver.load_graph(&url).unwrap();
    let graph = Rc::new(CompiledModuleGraph::compile(graph).unwrap());
    let mut runtime = Runtime::with_mode(
        graph,
        &url,
        Some("Tokenizer"),
        json!("42"),
        InputMode::Iterable,
    )
    .unwrap();
    runtime.run().unwrap();
    let text = runtime.serialize_result().unwrap().unwrap();
    let value: Json = serde_json::from_str(&text).unwrap();
    assert_eq!(value, json!([{"kind":"word","text":"42"}]));
}

#[test]
// req:runtime-core-004 req:cli-bootstrap-024 req:cli-bootstrap-030 req:cli-bootstrap-034
fn published_language_entries_receive_whole_source_as_one_scalar() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    for (path, entry, source, kind) in [
        (
            "src/lang/expression/expression.lang.uff",
            "ExpressionLang",
            "42",
            "number",
        ),
        (
            "src/lang/pattern/pattern.lang.uff",
            "PatternLang",
            "\"x\"",
            "equal",
        ),
        (
            "src/lang/uffda/uffda.lang.uff",
            "UffdaLang",
            "export Main;\nrule Main = any;",
            "module",
        ),
    ] {
        let url = root.join(path).unwrap();
        let graph = resolver.load_graph(&url).unwrap();
        let graph = Rc::new(CompiledModuleGraph::compile(graph).unwrap());
        let mut runtime = Runtime::new(graph, &url, Some(entry), json!(source)).unwrap();
        runtime.run().unwrap();
        runtime.read(|execution| {
            assert_eq!(
                execution.result().unwrap().kind,
                MatchKind::Ok,
                "{entry}: {:?}",
                execution.failure_diagnostic()
            );
            assert!(execution.is_clean(), "{entry} must match cleanly");
        });
        let text = runtime.serialize_result().unwrap().unwrap();
        let value: Json = serde_json::from_str(&text).unwrap();
        assert_eq!(value["kind"], kind, "{entry}: {value}");
        if entry == "ExpressionLang" {
            assert_eq!(value["value"], 42);
        }
    }
}

#[test]
// req:runtime-core-010 req:rules-001
fn named_parameterized_rule_arguments_specialize_when_invoked_not_when_captured() {
    let mut apply = rule(
        "Apply",
        json!({"kind":"resolve","targetKind":"reference","name":"Body",
            "args":[reference("Item")]}),
    );
    apply["parameters"] = json!([{"name":"Body"},{"name":"Item"}]);
    let mut body = rule("Body", reference("P"));
    body["parameters"] = json!([{"name":"P"}]);
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"resolve","targetKind":"reference","name":"Apply",
                "args":[reference("Body"),reference("X")]})
            ),
            apply,
            body,
            rule("X", equal(json!("x")))
        ]),
        "Main",
        "x",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(execution.result().unwrap().end, 1);
    });
}

#[test]
// req:rules-001 req:runtime-core-004
fn backtracking_reuses_projected_rule_value_and_restores_callers_bindings() {
    let mut projected = rule("R", equal(json!("x")));
    projected["expression"] = json!({"kind":"number","value":42});
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("R"),equal(json!("!"))]},
                    reference("R")
                ]})
            ),
            projected
        ]),
        "Main",
        "x",
    );
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.strict_eq(Value::Number(42.0)));
        assert_eq!(result.end, 1);
        assert!(execution.memo_hits() > 0);
    });
}

#[test]
// req:runtime-core-008 req:runtime-core-009
fn ten_thousand_nested_rule_calls_are_stack_safe_and_collector_rooted() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"or","patterns":[
                {"kind":"then","patterns":[equal(json!("(")),reference("Main"),equal(json!(")"))]},
                equal(json!("x"))
            ]})
        )]),
        "Main",
        &format!("{}x{}", "(".repeat(10_000), ")".repeat(10_000)),
    );
    let mut steps = 0;
    while !runtime.step().unwrap() {
        steps += 1;
        if steps % 10_000 == 0 {
            runtime.collect_all();
        }
    }
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(execution.result().unwrap().end, 20_001);
    });
}

#[test]
// req:direct-left-recursion-001 req:direct-left-recursion-002
fn direct_left_recursion_grows_projected_seeds_and_keeps_rejected_attempt() {
    let mut recursive = rule(
        "Main",
        json!({"kind":"or","patterns":[
            {"kind":"projection",
                "pattern":{"kind":"then","patterns":[
                    {"kind":"variable","name":"left","pattern":reference("Main")},
                    equal(json!("+")),equal(json!("x"))
                ]},
                "expression":{"kind":"invocation","expression":{"kind":"reference","name":"add"},
                    "args":[{"kind":"reference","name":"left"},{"kind":"number","value":1}]}},
            {"kind":"projection","pattern":equal(json!("x")),
                "expression":{"kind":"number","value":1}}
        ]}),
    );
    recursive["expression"] = json!({"kind":"reference","name":"_"});
    let mut runtime = text_runtime(json!([recursive]), "Main", "x+x+x");
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }

    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 5);
        assert!(result.value.strict_eq(Value::Number(3.0)));
        let mut nodes = vec![result];
        let mut rejected = false;
        while let Some(node) = nodes.pop() {
            rejected |= node.kind == MatchKind::Fail && node.start == 0;
            nodes.extend(node.children.iter().copied());
        }
        assert!(rejected);
    });
}

#[test]
// req:direct-left-recursion-001 req:direct-left-recursion-002
fn rejected_nonprogress_growth_does_not_apply_rule_projection_again() {
    let mut recursive = rule(
        "Main",
        json!({"kind":"or","patterns":[
            {"kind":"then","patterns":[reference("Main"),equal(json!("x"))]},
            reference("Main"),
            equal(json!("x"))
        ]}),
    );
    recursive["expression"] = json!({
        "kind":"invocation","expression":{"kind":"reference","name":"length"},
        "args":[{"kind":"reference","name":"_"}]
    });
    let mut runtime = text_runtime(json!([recursive]), "Main", "x");
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(execution.is_clean());
        assert!(
            execution
                .result()
                .unwrap()
                .value
                .strict_eq(Value::Number(1.0))
        );
    });
}

#[test]
// req:indirect-left-recursion-001 req:indirect-left-recursion-002
fn mutual_cycle_invalidates_only_seed_dependent_outcomes() {
    let mut runtime = text_runtime(
        json!([
            rule(
                "A",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("B"),equal(json!("a"))]},
                    equal(json!("x"))
                ]})
            ),
            rule(
                "B",
                json!({"kind":"or","patterns":[reference("A"),equal(json!("x"))]})
            )
        ]),
        "A",
        "xaa",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(execution.result().unwrap().end, 3);
    });
}

#[test]
// req:indirect-left-recursion-002 req:direct-left-recursion-001
fn independent_precedence_cycles_remain_reusable_during_outer_growth() {
    let mut runtime = text_runtime(
        json!([
            rule(
                "E",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("E"),equal(json!("+")),reference("T")]},
                    reference("T")
                ]})
            ),
            rule(
                "T",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("T"),equal(json!("*")),reference("N")]},
                    reference("N")
                ]})
            ),
            rule("N", equal(json!("x")))
        ]),
        "E",
        "x*x+x*x+x*x",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(execution.is_clean());
        assert_eq!(execution.result().unwrap().end, 11);
        assert!(execution.body_attempts() < 35);
        assert!(execution.memo_hits() > 0);
    });
}

#[test]
// req:indirect-left-recursion-001 req:indirect-left-recursion-002
fn nested_heads_retain_accepted_seed_dependencies_when_rejected_attempt_does_not_read_them() {
    let mut runtime = text_runtime(
        json!([
            rule(
                "A",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("B"),equal(json!("a"))]},
                    equal(json!("x"))
                ]})
            ),
            rule(
                "B",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[reference("B"),equal(json!("b"))]},
                    reference("B"),
                    reference("A"),
                    equal(json!("x"))
                ]})
            )
        ]),
        "A",
        "xaa",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(execution.is_clean());
        assert_eq!(execution.result().unwrap().end, 3);
    });
}

#[test]
// req:direct-left-recursion-001 req:indirect-left-recursion-003
fn cycles_without_a_base_case_terminate_with_the_real_failed_attempt() {
    let mut runtime = text_runtime(
        json!([rule("A", reference("B")), rule("B", reference("A"))]),
        "A",
        "",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert!(!result.children.is_empty());
        assert!(execution.body_attempts() < 10);
    });
}

#[test]
// req:runtime-core-010
fn inline_arguments_capture_variables_without_leaking_bindings() {
    let mut generic = rule("Show", reference("P"));
    generic["parameters"] = json!([{"name":"P"}]);
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"then","patterns":[
                    {"kind":"variable","name":"x","pattern":equal(json!("x"))},
                    {"kind":"resolve","targetKind":"reference","name":"Show","args":[
                        {"kind":"projection","pattern":{"kind":"ok"},"expression":{
                            "kind":"invocation","expression":{"kind":"reference","name":"length"},
                            "args":[{"kind":"reference","name":"x"}]}}
                    ]}
                ]})
            ),
            generic
        ]),
        "Main",
        "x",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        let Value::Array(values) = result.value.raw() else {
            panic!("sequence expected")
        };
        assert!(values.borrow()[1].strict_eq(Value::Number(1.0)));
        assert!(result.environment.get("x").is_none());
    });
}

#[test]
// req:runtime-core-010
fn declared_argument_rules_do_not_capture_callers_variables() {
    let mut generic = rule("Show", reference("P"));
    generic["parameters"] = json!([{"name":"P"}]);
    let mut separate = rule("Separate", json!({"kind":"ok"}));
    separate["expression"] = json!({"kind":"reference","name":"x"});
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"then","patterns":[
                    {"kind":"variable","name":"x","pattern":equal(json!("x"))},
                    {"kind":"resolve","targetKind":"reference","name":"Show","args":[reference("Separate")]}
                ]})
            ),
            generic,
            separate
        ]),
        "Main",
        "x",
    );
    assert_eq!(
        runtime.run().unwrap_err(),
        RuntimeError::Expression(EvaluationError::UnknownReference("x".into()))
    );
}

#[test]
// req:runtime-core-011 req:runtime-core-010
fn same_module_func_parameter_patterns_do_not_inherit_rule_arguments() {
    let mut generic = rule(
        "Generic",
        json!({"kind":"projection","pattern":{"kind":"ok"},
            "expression":{"kind":"invocation","expression":{"kind":"reference","name":"F"},
                "args":[{"kind":"value","value":"x"}]}}),
    );
    generic["parameters"] = json!([{"name":"P"}]);
    let (graph, url) = module_graph(json!({
        "imports":[],
        "exports":[{"kind":"rule","name":"Main","default":true}],
        "rules":[
            rule("Main",json!({"kind":"resolve","targetKind":"reference",
                "name":"Generic","args":[reference("X")]})),
            generic,
            rule("X",equal(json!("x")))
        ],
        "funcs":[{"name":"F","pattern":reference("P"),
            "expression":{"kind":"number","value":42}}],
        "decorators":[]
    }));
    let mut runtime = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    assert_eq!(
        runtime.run().unwrap_err(),
        RuntimeError::UnknownRule("P".into())
    );
}

#[test]
// req:runtime-core-011 req:runtime-core-010
fn lambdas_inside_declared_func_bodies_do_not_inherit_callers_rule_arguments() {
    let mut generic = rule(
        "Generic",
        json!({"kind":"projection","pattern":{"kind":"ok"},
            "expression":{"kind":"invocation","expression":{"kind":"reference","name":"F"},
                "args":[{"kind":"value","value":"x"}]}}),
    );
    generic["parameters"] = json!([{"name":"P"}]);
    let (graph, url) = module_graph(json!({
        "imports":[],
        "exports":[{"kind":"rule","name":"Main","default":true}],
        "rules":[
            rule("Main",json!({"kind":"resolve","targetKind":"reference",
                "name":"Generic","args":[reference("X")]})),
            generic,
            rule("X",equal(json!("x")))
        ],
        "funcs":[{"name":"F","pattern":{"kind":"any"},
            "expression":{"kind":"invocation","expression":{
                "kind":"lambda","pattern":reference("P"),
                "expression":{"kind":"number","value":42}
            },"args":[{"kind":"value","value":"x"}]}}],
        "decorators":[]
    }));
    let mut runtime = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    assert_eq!(
        runtime.run().unwrap_err(),
        RuntimeError::UnknownRule("P".into())
    );
}

#[test]
// req:rules-001
fn expression_errors_are_stable_and_retained_across_steps_and_collection() {
    let mut projected = rule("Main", equal(json!("x")));
    projected["expression"] = json!({"kind":"reference","name":"missing"});
    let mut runtime = text_runtime(json!([projected]), "Main", "x");
    let error = runtime.run().unwrap_err();
    runtime.collect_all();
    assert_eq!(runtime.step().unwrap_err(), error);
    runtime.read(|execution| {
        assert_eq!(execution.error(), Some(&error));
        let context = execution.error_context().unwrap();
        assert_eq!(context.rule_name, "Main");
        assert_eq!(context.entered_at, 0);
    });
}

#[test]
// req:rules-001 req:runtime-core-004
fn computed_pipeline_inputs_do_not_share_memos_even_at_equal_source_spans() {
    let pipeline = |value: &str| {
        json!({"kind":"pipeline","steps":[
            {"kind":"projection","pattern":{"kind":"ok"},
             "expression":{"kind":"value","value":value}},
            reference("R")
        ]})
    };
    let mut projected = rule("R", json!({"kind":"any"}));
    projected["expression"] = json!({"kind":"reference","name":"_"});
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"or","patterns":[
                    {"kind":"then","patterns":[pipeline("a"),{"kind":"fail"}]},
                    pipeline("b")
                ]})
            ),
            projected
        ]),
        "Main",
        "",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        let Value::String(value) = execution.result().unwrap().value.raw() else {
            panic!("second computed domain must match b")
        };
        assert_eq!(&*value, "b");
    });
}

#[test]
// req:runtime-core-004 req:over-001 req:rules-001
fn nested_keys_do_not_alias_positions_with_equal_wrapped_spans() {
    let (graph, url) = graph(
        json!([
            rule(
                "Main",
                json!({"kind":"over","keys":{
                "a":reference("R"),"b":reference("R")
            },"rest":[]})
            ),
            rule("R", equal(json!("x")))
        ]),
        "Main",
    );
    let mut runtime = Runtime::new(graph, &url, None, json!({"a":"x","b":"y"})).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
    });
}

#[test]
// req:runtime-core-004 req:compiled-patterns-003
fn failure_diagnostic_uses_the_retained_furthest_authored_position() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"then","patterns":[
                equal(json!("x")),equal(json!("!"))
            ]})
        )]),
        "Main",
        "xy",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        let diagnostic = execution.failure_diagnostic().unwrap();
        assert_eq!(diagnostic.kind, PatternKind::Equal);
        assert_eq!(diagnostic.position, 1);
        assert_eq!(execution.result().unwrap().end, 0);
    });
}

#[test]
// req:runtime-core-004 req:compiled-patterns-003
fn successful_pipeline_failures_cannot_focus_a_later_failure() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"then","patterns":[
                {"kind":"pipeline","steps":[{"kind":"or","patterns":[
                    {"kind":"then","patterns":[
                        {"kind":"quantifier","pattern":{"kind":"any"},
                            "min":{"kind":"value.literal","value":8},
                            "max":{"kind":"value.literal","value":8}},
                        {"kind":"fail"}
                    ]},
                    {"kind":"ok"}
                ]}]},
                equal(json!("z"))
            ]})
        )]),
        "Main",
        "xxxxxxxx",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.failure_diagnostic().unwrap().position, 0);
    });
}

#[test]
// req:runtime-core-010
fn captured_arguments_forward_callers_rule_parameters() {
    let mut show = rule("Show", reference("P"));
    show["parameters"] = json!([{"name":"P"}]);
    let mut outer = rule(
        "Outer",
        json!({"kind":"resolve","targetKind":"reference","name":"Show","args":[
            {"kind":"then","patterns":[reference("Q"),{"kind":"ok"}]}
        ]}),
    );
    outer["parameters"] = json!([{"name":"Q"}]);
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"resolve","targetKind":"reference",
                "name":"Outer","args":[reference("X")]})
            ),
            outer,
            show,
            rule("X", equal(json!("x")))
        ]),
        "Main",
        "x",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(execution.is_clean());
        assert_eq!(execution.result().unwrap().end, 1);
    });
}

#[test]
// req:cli-run-003 req:runtime-core-003
fn empty_input_mode_is_not_scalar_null() {
    let (graph, url) = graph(json!([rule("Main", json!({"kind":"end"}))]), "Main");
    let mut scalar = Runtime::new(graph.clone(), &url, None, Json::Null).unwrap();
    scalar.run().unwrap();
    scalar.read(|execution| assert_eq!(execution.result().unwrap().kind, MatchKind::Fail));
    let mut empty = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    empty.run().unwrap();
    empty.read(|execution| assert!(execution.is_clean()));
}

#[test]
// req:error-recovery-001 req:error-recovery-002 req:error-recovery-007
fn recovery_runs_only_after_discovery_and_exposes_accepted_activations() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"then","patterns":[
                {"kind":"recover","pattern":equal(json!("x")),"skip":{"kind":"any"}},
                {"kind":"end"}
            ]})
        )]),
        "Main",
        "?",
    );
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
        assert_eq!(execution.recoveries().len(), 1);
        let recovery = execution.recoveries()[0];
        assert_eq!(execution.diagnostics().len(), 1);
        assert_eq!(recovery.children[0].kind, MatchKind::Fail);
        assert_eq!(recovery.children[1].kind, MatchKind::Ok);
        assert_eq!(recovery.end, 1);
    });
}

#[test]
// req:error-recovery-001 req:error-recovery-003 req:error-recovery-005
fn clean_alternative_wins_without_recovery_phase() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"or","patterns":[
                {"kind":"recover","pattern":equal(json!("x")),"skip":{"kind":"any"}},
                equal(json!("?"))
            ]})
        )]),
        "Main",
        "?",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(execution.is_clean());
        assert!(execution.recoveries().is_empty());
        assert!(execution.diagnostics().is_empty());
    });
}

#[test]
// req:error-recovery-006 req:error-recovery-001
fn a_stabilized_failed_cycle_does_not_mask_a_later_recovery() {
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"then","patterns":[
                    {"kind":"maybe","pattern":reference("H")},
                    {"kind":"recover","pattern":reference("B"),"skip":{"kind":"any"}},
                    {"kind":"end"}
                ]})
            ),
            rule("H", reference("B")),
            rule("B", reference("H"))
        ]),
        "Main",
        "?",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(execution.recoveries().len(), 1);
    });
}

#[test]
// req:error-recovery-006 req:error-recovery-002
fn a_successful_growth_seed_does_not_mask_real_syntax_recovery() {
    let mut runtime = text_runtime(
        json!([
            rule(
                "Main",
                json!({"kind":"then","patterns":[reference("R"),{"kind":"end"}]})
            ),
            rule(
                "R",
                json!({"kind":"or","patterns":[
                    {"kind":"recover","pattern":{"kind":"then","patterns":[
                        reference("R"),equal(json!("!"))
                    ]},"skip":{"kind":"then","patterns":[{"kind":"any"},{"kind":"any"}]}},
                    equal(json!("x"))
                ]})
            )
        ]),
        "Main",
        "x?",
    );
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
        assert_eq!(execution.recoveries().len(), 1);
        assert_eq!(execution.diagnostics().len(), 1);
    });
}

#[test]
// req:rule-decorators-003 req:rule-decorators-004 req:rule-decorators-006
fn decorators_use_canonical_structural_subjects_and_record_presence() {
    let (graph, url) = module_graph(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [{
            "name":"Main","parameters":[],"pattern":{"kind":"ok"},
            "attributes":[{"name":"Describe","args":[]},{"name":"Marker","args":[]}]
        }],
        "funcs":[],
        "decorators":[
            {"name":"Describe","pattern":{"kind":"end"},
             "expression":{"kind":"member","expression":{"kind":"reference","name":"this"},"name":"name"}},
            {"name":"Marker","pattern":{"kind":"end"},"expression":{"kind":"value","value":null}}
        ]
    }));
    let mut runtime = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }
    runtime.read(|execution| {
        let main = execution
            .declarations()
            .iter()
            .find(|declaration| declaration.member.kind == MemberKind::Rule)
            .unwrap();
        assert_eq!(main.attributes.borrow().len(), 2);
        let Value::Object(metadata) = main.metadata else {
            panic!("keyed metadata required")
        };
        let Value::String(name) = metadata.borrow().get("Describe").unwrap().raw() else {
            panic!("canonical declaration name expected")
        };
        assert_eq!(&*name, "Main");
        assert!(
            metadata
                .borrow()
                .get("Marker")
                .unwrap()
                .strict_eq(Value::Null)
        );
        let origins = execution.metadata_path(&[0]).unwrap();
        assert_eq!(origins.len(), 1);
        assert!(Gc::ptr_eq(origins[0], *main));
    });
}

#[test]
// req:rule-decorators-003 req:rule-decorators-005
fn self_and_mutually_decorated_declarations_are_acyclic() {
    let (graph, url) = module_graph(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [rule("Main",json!({"kind":"ok"}))],
        "funcs": [],
        "decorators":[
            {"name":"A","pattern":{"kind":"end"},"expression":{"kind":"number","value":1},
             "attributes":[{"name":"A","args":[]},{"name":"B","args":[]}]},
            {"name":"B","pattern":{"kind":"end"},"expression":{"kind":"number","value":2},
             "attributes":[{"name":"A","args":[]}]}
        ]
    }));
    let mut runtime = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let decorated: Vec<_> = execution
            .declarations()
            .iter()
            .filter(|declaration| declaration.member.kind == MemberKind::Decorator)
            .collect();
        assert_eq!(decorated[0].attributes.borrow().len(), 2);
        assert_eq!(decorated[1].attributes.borrow().len(), 1);
    });
}

#[test]
// req:rule-decorators-005
fn duplicate_resolved_decorator_identity_fails_before_matching() {
    let (graph, url) = module_graph(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules":[{"name":"Main","parameters":[],"pattern":{"kind":"ok"},
            "attributes":[{"name":"D","args":[]},{"name":"D","args":[]}]}],
        "funcs":[],
        "decorators":[{"name":"D","pattern":{"kind":"end"},
            "expression":{"kind":"value","value":null}}]
    }));
    let mut runtime = Runtime::with_mode(graph, &url, None, Json::Null, InputMode::Empty).unwrap();
    assert!(matches!(
        runtime.run(),
        Err(RuntimeError::Decorator(message)) if message.contains("more than once")
    ));
}

fn explain_test_rule(declaration: &DeclarationMetadata<'_>) -> Option<String> {
    let Value::Object(metadata) = declaration.metadata.raw() else {
        return None;
    };
    let Value::String(text) = metadata.borrow().get("Why")?.raw() else {
        return None;
    };
    Some((*text).clone())
}

fn explained_graph(rules: Json) -> (Rc<CompiledModuleGraph>, Url) {
    module_graph(json!({
        "imports":[],"exports":[{"kind":"rule","name":"Main","default":true}],
        "rules":rules,"funcs":[],
        "decorators":[{"name":"Why","pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"_"}}]
    }))
}

fn explained_rule(name: &str, pattern: Json, explanation: &str) -> Json {
    let mut result = rule(name, pattern);
    result["attributes"] = json!([{"name":"Why","args":[{"kind":"value","value":explanation}]}]);
    result
}

#[test]
// req:compiled-patterns-003 req:rule-decorators-004 req:runtime-core-004
fn diagnostics_use_real_terminals_and_host_supplied_metadata_explanations() {
    let (graph, url) = explained_graph(json!([
        rule(
            "Main",
            json!({"kind":"then","patterns":[equal(json!("x")),reference("Closing")]})
        ),
        explained_rule(
            "Closing",
            equal(json!("]")),
            "A closing bracket is required."
        )
    ]));
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("x!"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.collect_all();
    let plain = runtime.diagnostics();
    assert_eq!(plain.len(), 1);
    assert!(plain[0].explanation.is_none());
    assert_eq!(plain[0].unexpected.as_deref(), Some("\"!\""));
    assert_eq!(plain[0].span.start, 1);
    assert!(plain[0].expected.iter().any(|label| label.contains(']')));
    let diagnostics = runtime.diagnostics_with(explain_test_rule);
    assert_eq!(
        diagnostics[0].explanation.as_deref(),
        Some("A closing bracket is required.")
    );
    assert!(
        diagnostics[0]
            .message
            .starts_with("A closing bracket is required.\nUnexpected")
    );
    assert_eq!(diagnostics[0].rules.last().unwrap().name, "Main");
    let owned = diagnostics[0].clone();
    runtime.collect_all();
    assert_eq!(runtime.diagnostics_with(explain_test_rule)[0], owned);
}

#[test]
// req:compiled-patterns-003 req:rule-decorators-004
fn explanations_must_begin_at_the_hole_and_cover_every_tied_alternative() {
    let (graph, url) = explained_graph(json!([
        explained_rule(
            "Main",
            json!({"kind":"or","patterns":[reference("A"),reference("B")]}),
            "Choose a token."
        ),
        explained_rule("A", equal(json!("a")), "Only A."),
        explained_rule("B", equal(json!("b")), "Only B.")
    ]));
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(
        runtime.diagnostics_with(explain_test_rule)[0]
            .explanation
            .as_deref(),
        Some("Choose a token.")
    );
    let (graph, url) = explained_graph(json!([explained_rule(
        "Main",
        json!({"kind":"then","patterns":[equal(json!("x")),equal(json!("!"))]}),
        "How this production begins."
    )]));
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("x?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert!(
        runtime.diagnostics_with(explain_test_rule)[0]
            .explanation
            .is_none()
    );
}

#[test]
// req:error-recovery-001 req:error-recovery-008 req:compiled-patterns-003
fn diagnostics_report_every_recovery_before_a_final_failure() {
    let recover =
        || json!({"kind":"recover","pattern":reference("Required"),"skip":{"kind":"any"}});
    let (graph, url) = explained_graph(json!([
        rule(
            "Main",
            json!({"kind":"then","patterns":[recover(),recover(),equal(json!("!"))]})
        ),
        explained_rule("Required", equal(json!("x")), "Expected x here.")
    ]));
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("??z"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    let diagnostics = runtime.diagnostics_with(explain_test_rule);
    assert_eq!(diagnostics.len(), 3, "{diagnostics:#?}");
    assert_eq!(
        diagnostics.iter().map(|item| item.kind).collect::<Vec<_>>(),
        vec![
            DiagnosticKind::Recovery,
            DiagnosticKind::Recovery,
            DiagnosticKind::Failure
        ]
    );
    assert_eq!(
        diagnostics
            .iter()
            .map(|item| item.span.start)
            .collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
    assert_eq!(diagnostics[0].span.end, 1);
    assert_eq!(diagnostics[1].span.end, 2);
    assert!(
        diagnostics[..2]
            .iter()
            .all(|item| item.explanation.as_deref() == Some("Expected x here."))
    );
}

#[test]
// req:error-recovery-008 req:compiled-patterns-003
fn recovery_diagnostics_include_failures_absorbed_by_preceding_matches() {
    let (graph, url) = explained_graph(json!([
        rule(
            "Main",
            json!({"kind":"then","patterns":[
                {"kind":"maybe","pattern":{"kind":"then","patterns":[equal(json!("x")),reference("Separator")]}},
                {"kind":"recover","pattern":reference("Start"),"skip":{"kind":"then","patterns":[{"kind":"any"},{"kind":"any"}]}},
                {"kind":"end"}
            ]})
        ),
        explained_rule("Separator", equal(json!("!")), "Missing separator after x."),
        explained_rule("Start", equal(json!("y")), "Expected y.")
    ]));
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("x?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    let diagnostics = runtime.diagnostics_with(explain_test_rule);
    assert_eq!(diagnostics.len(), 1, "{diagnostics:#?}");
    assert_eq!(diagnostics[0].kind, DiagnosticKind::Recovery);
    assert_eq!(diagnostics[0].span.start, 0);
    assert_eq!(diagnostics[0].span.end, 2);
    assert_eq!(diagnostics[0].focus_span.start, 1);
    assert_eq!(
        diagnostics[0].explanation.as_deref(),
        Some("Missing separator after x.")
    );
}

#[test]
// req:error-recovery-008 req:compiled-patterns-003 req:runtime-core-008
fn diagnostics_are_owned_stack_safe_and_report_end_of_input_without_a_token() {
    let mut runtime = text_runtime(
        json!([rule(
            "Main",
            json!({"kind":"or","patterns":[
                {"kind":"then","patterns":[equal(json!("(")),reference("Main"),equal(json!(")"))]},
                equal(json!("x"))
            ]})
        )]),
        "Main",
        &format!("{}x{}", "(".repeat(5000), ")".repeat(4999)),
    );
    runtime.run().unwrap();
    runtime.collect_all();
    let diagnostics = runtime.diagnostics();
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(diagnostics[0].span.start, 10000);
    assert!(diagnostics[0].unexpected.is_none());
    assert!(diagnostics[0].message.contains("<end of input>"));
    runtime.collect_all();
    assert_eq!(runtime.diagnostics(), diagnostics);
}

#[test]
// req:error-recovery-008 req:compiled-patterns-003 req:rule-decorators-004
fn published_grammar_diagnostics_use_the_real_documentation_error() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    let url = root.join("src/lang/uffda/uffda.lang.uff").unwrap();
    let graph = Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
    let mut runtime = Runtime::new(
        graph,
        &url,
        Some("UffdaLang"),
        json!("export Main;\nrule = any;"),
    )
    .unwrap();
    runtime.run().unwrap();
    runtime.collect_all();
    let diagnostics = runtime.diagnostics_with(|declaration| {
        let Value::Object(metadata) = declaration.metadata.raw() else {
            return None;
        };
        let Value::Object(documentation) = metadata.borrow().get("Documentation")?.raw() else {
            return None;
        };
        let Value::String(error) = documentation.borrow().get("error")?.raw() else {
            return None;
        };
        Some((*error).clone())
    });
    assert!(!diagnostics.is_empty());
    assert!(
        diagnostics.iter().any(|item| item.explanation.is_some()),
        "{diagnostics:#?}"
    );
    let named = diagnostics
        .iter()
        .find(|item| {
            item.explanation
                .as_deref()
                .is_some_and(|message| message.starts_with("A declaration needs a name"))
        })
        .expect("the grammar's DeclarationName explanation must cover the hole");
    assert_eq!(named.focus_span.start, 18);
    assert_eq!(named.unexpected.as_deref(), Some("\"=\""));
    assert_eq!(
        named.unexpected_span.unwrap(),
        crate::provenance::Origin { start: 18, end: 19 }
    );
}

#[test]
// req:rules-001 req:rule-decorators-004 req:error-recovery-001
fn canonical_local_rule_entry_preserves_exports_and_recovery_target() {
    let (graph, url) = module_graph(json!({
        "imports":[],"exports":[{"kind":"rule","name":"Main","default":true}],
        "rules":[rule("Main",equal(json!("main"))),
            rule("Render",json!({"kind":"recover","pattern":equal(json!("x")),"skip":{"kind":"any"}}))],
        "funcs":[],"decorators":[]
    }));
    let member = graph.resolve(&url, "Render").unwrap();
    assert!(graph.export(&url, Some("Render")).is_none());
    assert!(matches!(
        Runtime::with_mode(
            graph.clone(),
            &url,
            Some("Render"),
            json!("?"),
            InputMode::Iterable
        ),
        Err(RuntimeError::UnknownRule(_))
    ));
    let mut runtime =
        Runtime::for_member(graph.clone(), &member, json!("?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
        assert_eq!(execution.recoveries().len(), 1);
    });
    assert_eq!(runtime.diagnostics()[0].kind, DiagnosticKind::Recovery);
    assert!(graph.export(&url, Some("Render")).is_none());
}

#[test]
// req:error-recovery-002 req:error-recovery-007 req:error-recovery-008
fn published_module_recovery_omits_skipped_declaration_without_json_null() {
    let mut resolver = Resolver::from_cwd().unwrap();
    let root = crate::builtins::register(&mut resolver).unwrap();
    let url = root.join("src/lang/uffda/uffda.lang.uff").unwrap();
    let graph = Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
    let mut runtime = Runtime::new(
        graph,
        &url,
        Some("UffdaLang"),
        json!("export Main; rule Main = any"),
    )
    .unwrap();
    runtime.run().unwrap();
    runtime.collect_all();
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
    });
    let json: Json = serde_json::from_str(&runtime.serialize_result().unwrap().unwrap()).unwrap();
    assert_eq!(json["kind"], "module");
    assert_eq!(
        json["declarations"],
        json!([{"kind":"export","name":"Main"}])
    );
    let diagnostics = runtime.diagnostics();
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(diagnostics[0].kind, DiagnosticKind::Recovery);
}

#[test]
// req:error-recovery-001 req:error-recovery-002 req:error-recovery-008 req:cli-match-001
fn standalone_patterns_share_recovery_diagnostics_and_rooted_serialization() {
    let pattern = serde_json::from_value(json!({"kind":"recover",
        "pattern":equal(json!("x")),
        "skip":{"kind":"projection","pattern":{"kind":"any"},
            "expression":{"kind":"value","value":{"kind":"error"}}}
    }))
    .unwrap();
    let mut runtime = Runtime::for_pattern(pattern, json!("?"), InputMode::Iterable).unwrap();
    while !runtime.step().unwrap() {
        runtime.collect_all();
    }
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
        assert!(execution.graph.is_none());
        assert!(execution.bindings.is_none());
    });
    assert_eq!(
        runtime.serialize_result().unwrap(),
        Some(r#"{"kind":"error"}"#.into())
    );
    let diagnostics = runtime.diagnostics();
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(diagnostics[0].kind, DiagnosticKind::Recovery);
    assert_eq!(diagnostics[0].unexpected.as_deref(), Some("\"?\""));
    assert_eq!(
        diagnostics[0].span,
        crate::provenance::Origin { start: 0, end: 1 }
    );
    assert!(diagnostics[0].rules.is_empty());
}

#[test]
// req:cli-match-001 req:compiled-patterns-003 req:error-recovery-001
fn standalone_patterns_preserve_clean_choice_and_furthest_failure() {
    let pattern = serde_json::from_value(json!({"kind":"or","patterns":[
        {"kind":"recover","pattern":equal(json!("x")),"skip":{"kind":"any"}},
        equal(json!("?"))
    ]}))
    .unwrap();
    let mut runtime = Runtime::for_pattern(pattern, json!("?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| assert!(execution.is_clean()));
    assert!(runtime.diagnostics().is_empty());
    let pattern = serde_json::from_value(
        json!({"kind":"then","patterns":[equal(json!("x")),equal(json!("!"))]}),
    )
    .unwrap();
    let mut runtime = Runtime::for_pattern(pattern, json!("x?"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    let diagnostics = runtime.diagnostics();
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(diagnostics[0].kind, DiagnosticKind::Failure);
    assert_eq!(diagnostics[0].focus_span.start, 1);
    assert_eq!(diagnostics[0].unexpected.as_deref(), Some("\"?\""));
}

#[test]
// req:cli-match-001 req:rules-001 req:expressions-runtime-007
fn standalone_patterns_allow_native_globals_but_reject_rule_requests_explicitly() {
    let pattern = serde_json::from_value(json!({"kind":"projection","pattern":{"kind":"any"},
        "expression":{"kind":"invocation","expression":{"kind":"reference","name":"add"},
            "args":[{"kind":"number","value":20},{"kind":"number","value":22}]}
    }))
    .unwrap();
    let mut runtime = Runtime::for_pattern(pattern, json!("x"), InputMode::Scalar).unwrap();
    runtime.run().unwrap();
    assert_eq!(runtime.serialize_result().unwrap(), Some("42".into()));
    let pattern = serde_json::from_value(reference("Missing")).unwrap();
    let mut runtime = Runtime::for_pattern(pattern, json!("x"), InputMode::Scalar).unwrap();
    assert_eq!(
        runtime.run().unwrap_err(),
        RuntimeError::UnknownRule("Missing".into())
    );
    assert_eq!(runtime.diagnostics()[0].kind, DiagnosticKind::Error);
}

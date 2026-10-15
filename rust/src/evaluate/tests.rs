use super::*;
use crate::expression::ArrayInitializer;
use crate::globals::NativeGlobal;
use serde_json::json;

#[test]
// req:runtime-strings-002
fn typed_member_computed_key_and_json_hook_arguments_preserve_surrogates() {
    for source in [
        r#"{"kind":"member","name":"\ud800","expression":{"kind":"value","value":{"\ud800":"\udfff"}}}"#,
        r#"{"kind":"member","name":"\ud800","expression":{"kind":"object","keys":[{"kind":"objectComputedKey","keyExpression":{"kind":"value","value":"\ud800"},"expression":{"kind":"value","value":"\udfff"}}]}}"#,
        r#"{"kind":"member","name":"0","expression":{"kind":"value","value":"\udfff"}}"#,
    ] {
        let mut evaluation = Evaluation::new(crate::json::from_str(source).unwrap());
        let result = evaluation.finish().unwrap();
        evaluation.collect();
        assert_eq!(
            evaluation
                .read(&result, |v| crate::coercion::string_text(v)
                    .unwrap()
                    .as_utf16()
                    .to_vec())
                .unwrap(),
            vec![0xdfff]
        );
    }
    let ast = crate::json::from_str(r#"{"kind":"object","keys":[{"kind":"objectKey","name":"\ud800","expression":{"kind":"object","keys":[{"kind":"objectKey","name":"toJSON","expression":{"kind":"lambda","pattern":{"kind":"into","pattern":{"kind":"variable","name":"key","pattern":{"kind":"any"}}},"expression":{"kind":"reference","name":"key"}}}]}}]}"#).unwrap();
    let mut evaluation = Evaluation::new(ast);
    let value = evaluation.finish().unwrap();
    let serialized = evaluation.serialize_rooted(&value).unwrap();
    evaluation.collect();
    assert_eq!(
        evaluation
            .read(&serialized, |v| crate::coercion::scalar_text(v).unwrap())
            .unwrap(),
        r#"{"\ud800":"\ud800"}"#
    );
}

fn host_callable(name: &str) -> HostCallable {
    HostCallable {
        id: 17,
        name: name.into(),
        arity: 1,
    }
}

#[test]
// req:runtime-core-014
fn evaluation_external_driver_reads_async_iterable_without_changing_native_invocation() {
    let ast = expression(json!({"kind":"invocation",
        "expression":{"kind":"reference","name":"reduce"},
        "args":[{"kind":"reference","name":"source"},{"kind":"value","value":0},{"kind":"reference","name":"add"}]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let source = crate::runtime::input::InputSource::new(
            mc,
            crate::runtime::input::Source {
                id: 1,
                name: "source".into(),
            },
        );
        Environment::new(
            mc,
            None,
            vec![("source".into(), Value::InputSource(source))],
        )
    });
    let mut requests = vec![];
    let future = evaluation.drive_external(|evaluation, request| {
        let ExternalRequest::Input(request) = request else {
            panic!("native callback must stay immediate")
        };
        evaluation.collect();
        requests.push(request.position);
        std::future::ready(ExternalCompletion::Input(Ok(if request.position < 2 {
            let number = request.position as f64 + 1.0;
            crate::runtime::input::InputCompletion::Item(HostCompletion::materialize(
                vec![],
                move |_, _| Ok(Value::Number(number)),
            ))
        } else {
            crate::runtime::input::InputCompletion::Eof
        })))
    });
    let result = bounded_drive(future).unwrap();
    assert_eq!(requests, [0, 1, 2]);
    assert!(
        evaluation
            .read(&result, |v| v.strict_eq(Value::Number(3.0)))
            .unwrap()
    );
}

#[test]
// req:runtime-memory-005 req:runtime-core-013
fn pointer_free_json_ancestry_mutates_during_incremental_mark_without_gc_barriers() {
    let mut arena =
        Arena::<Rootable![Gc<'_, JsonPath>]>::new(|mc| Gc::new(mc, JsonPath::default()));
    for _ in 0..3 {
        let _ = arena.finish_marking().unwrap();
        arena.mutate(|_, path| {
            assert!(path.0.borrow_mut().insert(42));
            assert!(path.0.borrow_mut().remove(&42));
        });
        arena.finish_cycle();
    }
}

fn host_expression(args: serde_json::Value) -> Expression {
    expression(
        json!({"kind":"invocation","expression":{"kind":"reference","name":"host"},
        "args":args}),
    )
}

fn suspend_host(evaluation: &mut Evaluation) -> HostRequest {
    for _ in 0..10_000 {
        if evaluation.step_status().unwrap() == StepStatus::Suspended {
            return evaluation.take_host_request().expect("one host request");
        }
    }
    panic!("host call did not suspend");
}

#[derive(Default)]
struct WakeCounter(std::sync::atomic::AtomicUsize);

impl std::task::Wake for WakeCounter {
    fn wake(self: std::sync::Arc<Self>) {
        self.wake_by_ref();
    }
    fn wake_by_ref(self: &std::sync::Arc<Self>) {
        self.0.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
}

fn bounded_drive<F: Future<Output = Result<RootedValue, EvaluationError>>>(
    future: F,
) -> Result<RootedValue, EvaluationError> {
    let counter = std::sync::Arc::new(WakeCounter::default());
    let waker = std::task::Waker::from(counter.clone());
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);
    for _ in 0..10_000 {
        let before = counter.0.load(std::sync::atomic::Ordering::SeqCst);
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return value,
            Poll::Pending => assert!(counter.0.load(std::sync::atomic::Ordering::SeqCst) > before),
        }
    }
    panic!("driver exceeded bounded cooperative polls");
}

#[test]
// req:runtime-core-013 req:runtime-memory-004
fn host_request_suspends_final_frame_and_resumes_rooted_composite_after_collection() {
    let mut evaluation = Evaluation::with_hosts(
        host_expression(json!([{"kind":"value","value":{"items":[1,2]}}])),
        vec![host_callable("host")],
    );
    let request = suspend_host(&mut evaluation);
    assert_eq!(request.callable, host_callable("host"));
    assert_eq!(request.arguments.len(), 1);
    assert!(evaluation.take_host_request().is_none());
    for _ in 0..3 {
        evaluation.collect();
        assert_eq!(evaluation.step_status().unwrap(), StepStatus::Suspended);
    }
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::HostPending
    );
    let identity = evaluation
        .read(&request.arguments[0], |value| {
            let Value::Object(object) = value else {
                panic!("expected object")
            };
            assert!(matches!(
                object.borrow().get("items").unwrap().raw(),
                Value::Array(_)
            ));
            Gc::as_ptr(object) as usize
        })
        .unwrap();
    evaluation
        .complete_host(
            &request,
            Ok(HostCompletion::Rooted(request.arguments[0].clone())),
        )
        .unwrap();
    evaluation.collect();
    let result = evaluation.finish().unwrap();
    assert_eq!(
        evaluation
            .read(&result, |value| {
                let Value::Object(object) = value else {
                    panic!("expected object")
                };
                Gc::as_ptr(object) as usize
            })
            .unwrap(),
        identity
    );
    assert_eq!(
        evaluation
            .complete_host(&request, Ok(HostCompletion::Rooted(result)))
            .unwrap_err(),
        EvaluationError::StaleHostRequest
    );
}

#[test]
// req:runtime-core-013
fn materializers_reenter_safely_with_retained_roots_and_non_json_composites() {
    let mut evaluation = Evaluation::with_hosts(
        host_expression(json!([{"kind":"value","value":[1,2]}])),
        vec![host_callable("host")],
    );
    let request = suspend_host(&mut evaluation);
    evaluation.collect();
    evaluation
        .complete_host(
            &request,
            Ok(HostCompletion::materialize(
                request.arguments.clone(),
                |mc, values| {
                    Ok(Value::map(
                        mc,
                        vec![
                            (Value::string(mc, "retained"), values[0]),
                            (
                                Value::string(mc, "symbol"),
                                Value::Symbol(Gc::new(mc, "host".into())),
                            ),
                        ],
                    ))
                },
            )),
        )
        .unwrap();
    evaluation.collect();
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| {
            let Value::Map(entries) = value else {
                panic!("expected non-JSON map")
            };
            assert_eq!(entries.borrow().len(), 2);
            let Value::Array(pair) = entries.borrow()[0] else {
                panic!("expected pair")
            };
            let Value::Array(retained) = pair.borrow()[1].raw() else {
                panic!("expected retained array")
            };
            assert_eq!(retained.borrow().len(), 2);
        })
        .unwrap();
}

#[test]
// req:runtime-core-013 req:runtime-memory-004
fn foreign_requests_and_results_fail_loudly_without_materializing_foreign_roots() {
    let mut first = Evaluation::with_hosts(host_expression(json!([])), vec![host_callable("host")]);
    let mut second =
        Evaluation::with_hosts(host_expression(json!([])), vec![host_callable("host")]);
    let first_request = suspend_host(&mut first);
    let second_request = suspend_host(&mut second);
    assert_eq!(
        second
            .complete_host(&first_request, Err("wrong request".into()))
            .unwrap_err(),
        EvaluationError::StaleHostRequest
    );
    assert_eq!(second.step_status().unwrap(), StepStatus::Suspended);
    let mut foreign = Evaluation::new(Expression::Number { value: 42.0 });
    let foreign_value = foreign.finish().unwrap();
    assert_eq!(
        first
            .complete_host(
                &first_request,
                Ok(HostCompletion::Rooted(foreign_value.clone()))
            )
            .unwrap_err(),
        EvaluationError::ForeignRoot
    );
    assert_eq!(
        first.step_status().unwrap_err(),
        EvaluationError::ForeignRoot
    );
    assert_eq!(
        second
            .complete_host(
                &second_request,
                Ok(HostCompletion::materialize(
                    vec![foreign_value],
                    |_, _| panic!("foreign roots must be validated first")
                ))
            )
            .unwrap_err(),
        EvaluationError::ForeignRoot
    );
}

#[test]
// req:runtime-core-013
fn host_errors_are_sticky_and_restore_authored_continuations() {
    let ast = expression(json!({"kind":"invocation",
        "expression":{"kind":"lambda","pattern":{"kind":"end"},
            "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},"args":[]}},
        "args":[]}));
    let mut evaluation = Evaluation::with_hosts(ast, vec![host_callable("host")]);
    let request = suspend_host(&mut evaluation);
    let error = EvaluationError::Host("network unavailable".into());
    assert_eq!(
        evaluation
            .complete_host(&request, Err("network unavailable".into()))
            .unwrap_err(),
        error
    );
    assert_eq!(
        error.to_string(),
        "host invocation failed: network unavailable"
    );
    evaluation.collect();
    assert_eq!(evaluation.step_status().unwrap_err(), error);
    assert_eq!(evaluation.finish().unwrap_err(), error);
    evaluation.arena.mutate(|_, state| {
        assert!(state.host_call.is_none());
        assert!(state.frames.is_empty());
        assert!(state.values.is_empty());
        assert!(state.items.is_empty());
        assert!(state.environment.get("host").is_some());
    });
}

struct Gate {
    ready: bool,
    waker: Option<std::task::Waker>,
}

struct PendingHostFuture {
    gate: std::sync::Arc<std::sync::Mutex<Gate>>,
    request: Option<HostRequest>,
    _lifetime: Rc<()>,
}

impl Future for PendingHostFuture {
    type Output = Result<HostCompletion, String>;
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let ready = {
            let mut gate = self.gate.lock().unwrap();
            if !gate.ready {
                gate.waker = Some(cx.waker().clone());
            }
            gate.ready
        };
        if !ready {
            return Poll::Pending;
        }
        let request = self.request.take().unwrap();
        Poll::Ready(Ok(HostCompletion::Rooted(request.arguments[0].clone())))
    }
}

#[test]
// req:runtime-core-013 req:runtime-memory-004
fn executor_independent_driver_polls_real_pending_future_then_wakes_and_completes() {
    let gate = std::sync::Arc::new(std::sync::Mutex::new(Gate {
        ready: false,
        waker: None,
    }));
    let mut evaluation = Evaluation::with_hosts(
        host_expression(json!([{"kind":"value","value":{"retained":[1,2,3]}}])),
        vec![host_callable("host")],
    );
    let counter = std::sync::Arc::new(WakeCounter::default());
    let waker = std::task::Waker::from(counter.clone());
    let mut cx = Context::from_waker(&waker);
    let mut driver = Box::pin(evaluation.drive(|evaluation, request| {
        evaluation.collect();
        assert_eq!(
            evaluation
                .read(&request.arguments[0], |v| v.runtime_type())
                .unwrap(),
            crate::value::RuntimeType::Object
        );
        PendingHostFuture {
            gate: gate.clone(),
            request: Some(request),
            _lifetime: Rc::new(()),
        }
    }));
    assert!(driver.as_mut().poll(&mut cx).is_pending());
    assert_eq!(counter.0.load(std::sync::atomic::Ordering::SeqCst), 0);
    assert!(gate.lock().unwrap().waker.is_some());
    driver.evaluation.collect();
    assert!(driver.as_mut().poll(&mut cx).is_pending());
    assert_eq!(counter.0.load(std::sync::atomic::Ordering::SeqCst), 0);
    let signal = gate.clone();
    std::thread::spawn(move || {
        let mut gate = signal.lock().unwrap();
        gate.ready = true;
        gate.waker.take().unwrap().wake();
    })
    .join()
    .unwrap();
    assert_eq!(counter.0.load(std::sync::atomic::Ordering::SeqCst), 1);
    let Poll::Ready(Ok(result)) = driver.as_mut().poll(&mut cx) else {
        panic!("expected completion")
    };
    drop(driver);
    evaluation.collect();
    assert_eq!(
        evaluation.read(&result, |v| v.runtime_type()).unwrap(),
        crate::value::RuntimeType::Object
    );
}

#[test]
// req:runtime-core-013
fn future_and_materializer_errors_normalize_and_release_temporary_continuations() {
    for materializer in [false, true] {
        let mut evaluation = Evaluation::with_hosts(
            host_expression(json!([{"kind":"value","value":{"retained":[1,2]}}])),
            vec![host_callable("host")],
        );
        let result = bounded_drive(evaluation.drive(|_, request| {
            std::future::ready(if materializer {
                Ok(HostCompletion::materialize(
                    request.arguments.clone(),
                    |_, _| Err("decode failed".into()),
                ))
            } else {
                Err("decode failed".into())
            })
        }));
        let error = EvaluationError::Host("decode failed".into());
        assert_eq!(result.unwrap_err(), error);
        evaluation.collect();
        assert_eq!(evaluation.finish().unwrap_err(), error);
        evaluation.arena.mutate(|_, state| {
            assert!(state.host_call.is_none());
            assert!(state.frames.is_empty());
            assert!(state.values.is_empty());
        });
    }
}

#[test]
// req:runtime-core-013
fn dropping_driver_cancels_continuation_and_drops_future_and_request_roots() {
    let gate = std::sync::Arc::new(std::sync::Mutex::new(Gate {
        ready: false,
        waker: None,
    }));
    let probe = Rc::new(());
    let weak_future = Rc::downgrade(&probe);
    let mut weak_request = None;
    let mut evaluation = Evaluation::with_hosts(
        host_expression(json!([{"kind":"value","value":[{"retained":true}]}])),
        vec![host_callable("host")],
    );
    let mut driver = Box::pin(evaluation.drive(|_, request| {
        weak_request = Some(Rc::downgrade(&request.token));
        PendingHostFuture {
            gate: gate.clone(),
            request: Some(request),
            _lifetime: probe.clone(),
        }
    }));
    let waker = std::task::Waker::from(std::sync::Arc::new(WakeCounter::default()));
    assert!(
        driver
            .as_mut()
            .poll(&mut Context::from_waker(&waker))
            .is_pending()
    );
    drop(driver);
    drop(probe);
    assert!(weak_future.upgrade().is_none());
    assert!(weak_request.unwrap().upgrade().is_none());
    assert_eq!(evaluation.finish().unwrap_err(), EvaluationError::Cancelled);
    evaluation.arena.mutate(|_, state| {
        assert!(state.host_call.is_none());
        assert!(state.frames.is_empty());
        assert!(state.values.is_empty());
    });
}

#[test]
// req:runtime-core-013 req:runtime-memory-002
fn cancellation_releases_argument_cycles_after_the_last_external_request_drops() {
    let mut arena = Arena::<
        Rootable![(
            ExpressionExecution<'_>,
            uffda_heap::GcWeak<'_, uffda_heap::RefLock<crate::value::ObjectProperties<'_>>>
        )],
    >::new(|mc| {
        let argument = Value::object(mc, vec![]);
        let Value::Object(object) = argument else {
            unreachable!()
        };
        object.borrow_mut(mc).set("self".into(), argument);
        (
            ExpressionExecution::call(
                mc,
                Value::host(mc, host_callable("host")),
                vec![argument],
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Value::Undefined,
            ),
            Gc::downgrade(object),
        )
    });
    let request = arena.mutate_root(|mc, (state, _)| {
        assert_eq!(state.step_status(mc).unwrap(), StepStatus::Suspended);
        state.take_host_request(mc).unwrap()
    });
    arena.finish_cycle();
    arena.mutate_root(|_, (state, _)| state.cancel());
    arena.finish_cycle();
    arena.mutate(|mc, (_, weak)| assert!(weak.upgrade(mc).is_some()));
    drop(request);
    arena.finish_cycle();
    arena.mutate(|mc, (_, weak)| assert!(weak.upgrade(mc).is_none()));
}

#[test]
// req:runtime-core-013 req:runtime-core-007
fn driver_preserves_ordered_children_native_calls_and_cooperative_wakes() {
    let ast = expression(json!({"kind":"array","expressions":[
        {"kind":"arrayElement","expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},
            "args":[{"kind":"value","value":1}]}},
        {"kind":"arrayElement","expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},
            "args":[{"kind":"value","value":2}]}}
    ]}));
    let mut evaluation = Evaluation::with_hosts(ast, vec![host_callable("host")]);
    let mut observed = vec![];
    let result = bounded_drive(evaluation.drive(|evaluation, request| {
        observed.push(
            evaluation
                .read(&request.arguments[0], |v| {
                    let Value::Number(n) = v else {
                        panic!("expected number")
                    };
                    n
                })
                .unwrap(),
        );
        evaluation.collect();
        std::future::ready(Ok(HostCompletion::Rooted(request.arguments[0].clone())))
    }))
    .unwrap();
    assert_eq!(observed, [1.0, 2.0]);
    evaluation
        .read(&result, |v| {
            let Value::Array(values) = v else {
                panic!("expected array")
            };
            assert!(values.borrow()[0].raw().strict_eq(Value::Number(1.0)));
            assert!(values.borrow()[1].raw().strict_eq(Value::Number(2.0)));
        })
        .unwrap();
    let mut immediate = Evaluation::new(expression(json!({
        "kind":"invocation","expression":{"kind":"reference","name":"add"},
        "args":[{"kind":"value","value":3},{"kind":"value","value":4}]
    })));
    let result = bounded_drive(immediate.drive(|_, _| {
        panic!("native call must not suspend");
        #[allow(unreachable_code)]
        std::future::ready(Err("unexpected".into()))
    }))
    .unwrap();
    assert!(
        immediate
            .read(&result, |v| v.strict_eq(Value::Number(7.0)))
            .unwrap()
    );
    let ast = expression(json!({"kind":"array","expressions":(0..200).map(|i|
        json!({"kind":"arrayElement","expression":{"kind":"value","value":i}})
    ).collect::<Vec<_>>()}));
    let mut immediate = Evaluation::new(ast);
    let result =
        bounded_drive(immediate.drive(|_, _| std::future::ready(Err("unexpected".into()))))
            .unwrap();
    assert_eq!(
        immediate
            .read(&result, |v| {
                let Value::Array(values) = v else {
                    panic!("expected array")
                };
                values.borrow().len()
            })
            .unwrap(),
        200
    );
}

#[test]
// req:runtime-core-013 req:runtime-core-012 req:expressions-runtime-007
fn host_callable_metadata_and_json_hooks_use_ordinary_call_dispatch() {
    for (name, expected) in [("name", json!("host")), ("length", json!(1))] {
        let mut evaluation = Evaluation::with_hosts(
            expression(json!({
                "kind":"member","name":name,"expression":{"kind":"reference","name":"host"}
            })),
            vec![host_callable("host")],
        );
        let result = evaluation.finish().unwrap();
        assert_eq!(
            evaluation
                .read(&result, |v| globals::json_text(v).unwrap().unwrap())
                .unwrap(),
            expected.to_string()
        );
    }
    let ast = expression(json!({"kind":"invocation",
        "expression":{"kind":"reference","name":"json"},
        "args":[{"kind":"object","keys":[{"kind":"objectKey","name":"toJSON",
            "expression":{"kind":"reference","name":"host"}}]}]}));
    let mut evaluation = Evaluation::with_hosts(ast, vec![host_callable("host")]);
    let result = bounded_drive(evaluation.drive(|_, _| {
        std::future::ready(Ok(HostCompletion::materialize(vec![], |mc, _| {
            Ok(Value::array(mc, vec![Value::Number(42.0)]))
        })))
    }))
    .unwrap();
    assert_eq!(
        evaluation
            .read(&result, |v| {
                let Value::String(text) = v else {
                    panic!("expected JSON")
                };
                (*text).clone()
            })
            .unwrap(),
        "[42]"
    );
}

#[test]
// req:runtime-core-013 req:expressions-runtime-007
fn authored_parameter_projection_forwards_child_host_request_and_shared_roots() {
    let ast = expression(json!({
        "kind":"invocation","expression":{"kind":"lambda",
            "pattern":{"kind":"projection","pattern":{"kind":"any"},
                "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},
                    "args":[{"kind":"reference","name":"_"}]}},
            "expression":{"kind":"reference","name":"_"}},
        "args":[{"kind":"value","value":{"retained":[1,2]}}]
    }));
    let mut evaluation = Evaluation::with_hosts(ast, vec![host_callable("host")]);
    let mut retained = None;
    let result = bounded_drive(evaluation.drive(|evaluation, request| {
        evaluation.arena.mutate(|_, state| {
            assert!(matches!(
                state.frames.last(),
                Some(Frame::Parameters { .. })
            ));
        });
        evaluation.collect();
        assert_eq!(
            evaluation
                .read(&request.arguments[0], |v| v.runtime_type())
                .unwrap(),
            crate::value::RuntimeType::Object
        );
        retained = Some(request.arguments[0].clone());
        std::future::ready(Ok(HostCompletion::Rooted(request.arguments[0].clone())))
    }))
    .unwrap();
    evaluation.collect();
    assert_eq!(
        evaluation.read(&result, |v| v.runtime_type()).unwrap(),
        crate::value::RuntimeType::Object
    );
    assert!(evaluation.read(&retained.unwrap(), |_| ()).is_ok());
}

#[test]
// req:runtime-core-012 req:expressions-runtime-004 req:runtime-memory-005
fn evaluator_rejects_callable_json_and_composite_text_at_every_boundary() {
    let native = json!({"kind":"reference","name":"add"});
    let authored = json!({"kind":"lambda","pattern":{"kind":"end"},
        "expression":{"kind":"value","value":"private source"}});
    for value in [native, authored] {
        for ast in [
            value.clone(),
            json!({"kind":"array","expressions":[{"kind":"arrayElement","expression":value}]}),
            json!({"kind":"object","keys":[{"kind":"objectKey","name":"secret","expression":value}]}),
        ] {
            let mut evaluation = Evaluation::new(expression(ast.clone()));
            let original = finish_with_collection(&mut evaluation);
            assert_eq!(
                evaluation.serialize_rooted(&original).unwrap_err(),
                EvaluationError::Native("cannot serialize callable to JSON".into())
            );
            evaluation.collect();
            assert!(evaluation.read(&original, |_| ()).is_ok());
            let ast = json!({"kind":"invocation","expression":{"kind":"reference","name":"json"},"args":[ast]});
            assert!(Evaluation::new(expression(ast)).finish().is_err());
        }
    }
    let hooked = json!({"kind":"object","keys":[{"kind":"objectKey","name":"toString",
        "expression":{"kind":"lambda","pattern":{"kind":"end"},
        "expression":{"kind":"reference","name":"should_not_run"}}}]});
    for value in [
        json!({"kind":"reference","name":"add"}),
        json!({"kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":1}}),
        json!({"kind":"value","value":[]}),
        json!({"kind":"value","value":{}}),
        hooked,
    ] {
        let mut evaluation = Evaluation::new(expression(
            json!({"kind":"string","values":["prefix",value]}),
        ));
        assert!(matches!(
            evaluation.finish(),
            Err(EvaluationError::StringCoercion(_))
        ));
        let mut evaluation = Evaluation::new(expression(
            json!({"kind":"member","name":"toString","expression":value}),
        ));
        assert_eq!(
            evaluation.finish().unwrap_err(),
            EvaluationError::UnsupportedMember
        );
    }
}

#[test]
// req:runtime-core-012 req:runtime-core-013 req:runtime-memory-005
fn callable_returned_by_json_hook_is_rejected_without_another_hook() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let origin = Origin { start: 0, end: 0 };
        let authored = CompiledExpression::new(Expression::Boolean { value: true }).bind(
            mc,
            environment,
            origin,
            Pattern::End,
        );
        for callable in [
            Value::Native(NativeGlobal::Add),
            authored,
            Value::host(mc, host_callable("private")),
        ] {
            let mut execution =
                ExpressionExecution::serialize(mc, Value::Null, environment, origin);
            execution.values.push(callable);
            execution.frames = vec![Frame::JsonHook {
                key: RuntimeString::default(),
                path: Gc::new(mc, JsonPath::default()),
            }];
            assert!(!execution.step(mc).unwrap());
            assert_eq!(
                execution.step(mc).unwrap_err(),
                EvaluationError::Native("cannot serialize callable to JSON".into())
            );
        }
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn serializer_paths_release_shared_siblings_and_isolate_reentrant_json_hooks() {
    let mut arena = Arena::<Rootable![ExpressionExecution<'_>]>::new(|mc| {
        let shared = Value::array(mc, vec![Value::Number(1.0)]);
        let hooked = Value::object(
            mc,
            vec![("toJSON".into(), Value::Native(NativeGlobal::Json))],
        );
        ExpressionExecution::serialize(
            mc,
            Value::array(mc, vec![shared, shared, hooked]),
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
        )
    });
    loop {
        let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate(|_, execution| {
        let Value::String(text) = execution.result().unwrap().raw() else {
            panic!("expected JSON")
        };
        assert_eq!(*text, r#"[[1],[1],"\"2\""]"#);
    });
    uffda_heap::rootless_mutate(|mc| {
        let cyclic = Value::array(mc, vec![]);
        let Value::Array(array) = cyclic else {
            unreachable!()
        };
        array.borrow_mut(mc).push(cyclic);
        let mut execution = ExpressionExecution::serialize(
            mc,
            cyclic,
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
        );
        let error = loop {
            match execution.step(mc) {
                Err(error) => break error,
                Ok(false) => {}
                Ok(true) => panic!("cycle was accepted"),
            }
        };
        assert!(matches!(error, EvaluationError::Native(message) if message.contains("circular")));
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn rooted_serializer_active_paths_use_linear_space_and_survive_frame_collection() {
    for depth in [64, 20_000] {
        let mut evaluation = Evaluation::with_environment(
            Expression::Reference {
                name: "deep".into(),
            },
            |mc| {
                let mut value = Value::Number(0.0);
                for _ in 0..depth {
                    value = Value::array(mc, vec![value]);
                }
                Environment::new(mc, None, vec![("deep".into(), value)])
            },
        );
        let original = evaluation.finish().unwrap();
        let serialized = evaluation.serialize_rooted(&original).unwrap();
        evaluation.collect();
        evaluation
            .read(&serialized, |value| {
                let Value::String(text) = value.raw() else {
                    panic!("expected JSON text")
                };
                assert_eq!(text.len(), depth * 2 + 1);
                assert_eq!(text.as_utf16()[depth], u16::from(b'0'));
            })
            .unwrap();
        evaluation
            .read(&original, |value| {
                assert!(matches!(value.raw(), Value::Array(_)));
            })
            .unwrap();

        let mut arena = Arena::<Rootable![ExpressionExecution<'_>]>::new(|mc| {
            let mut value = Value::Number(0.0);
            for _ in 0..depth {
                value = Value::array(mc, vec![value]);
            }
            ExpressionExecution::serialize(
                mc,
                value,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
            )
        });
        let batch = if depth == 64 { 1 } else { 1024 };
        loop {
            let done = arena.mutate_root(|mc, execution| {
                for _ in 0..batch {
                    assert!(execution.frames.len() <= depth * 3 + 4);
                    if let Some(Frame::JsonValue { path, .. }) = execution.frames.last() {
                        assert!(path.0.borrow().len() <= depth);
                    }
                    if execution.step(mc).unwrap() {
                        return true;
                    }
                }
                false
            });
            arena.finish_cycle();
            if done {
                break;
            }
        }
        arena.mutate(|_, execution| {
            assert!(execution.frames.is_empty());
            let Value::String(text) = execution.result().unwrap().raw() else {
                panic!("expected JSON text")
            };
            assert_eq!(text.len(), depth * 2 + 1);
        });
    }
}

#[test]
// req:expressions-runtime-007 req:runtime-core-007 req:runtime-memory-005
fn custom_iterator_next_consumes_completed_wrapped_records() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let origin = Origin { start: 0, end: 0 };
        for (record, expected_done) in [
            (json!({"done":false,"value":42}), false),
            (json!({"done":true,"value":42}), true),
        ] {
            let next = CompiledExpression::new(Expression::Value {
                value: Some(record.into()),
            })
            .bind(mc, environment, origin, Pattern::End);
            let cursor = Value::object(mc, vec![("next".into(), next)]);
            let iterator = Gc::new(
                mc,
                uffda_heap::RefLock::new(IterableState::Custom {
                    value: cursor,
                    factory: Value::Undefined,
                    cursor: Some(cursor),
                    index: 0,
                    done: false,
                }),
            );
            let mut execution = ExpressionExecution::new(
                mc,
                Expression::Boolean { value: false },
                environment,
                origin,
                Value::Undefined,
            );
            execution.frames = vec![Frame::Pull(iterator)];
            while !execution.step(mc).unwrap() {}
            let item = execution.items.pop().unwrap();
            let state = iterator.borrow();
            let IterableState::Custom { index, done, .. } = &*state else {
                panic!("expected a custom iterator");
            };
            assert_eq!(*done, expected_done);
            assert_eq!(*index, if expected_done { 0 } else { 1 });
            if expected_done {
                assert!(item.is_none());
            } else {
                assert!(item.unwrap().strict_eq(Value::Number(42.0)));
            }
        }
    });
}

#[test]
// req:expressions-runtime-003
fn compiled_missing_literal_evaluates_to_undefined_not_explicit_null() {
    for (ast, undefined) in [
        (json!({"kind":"value"}), true),
        (json!({"kind":"value","value":null}), false),
    ] {
        let mut evaluation = Evaluation::new(expression(ast));
        let result = evaluation.finish().unwrap();
        assert_eq!(
            evaluation
                .read(&result, |value| matches!(value, Value::Undefined))
                .unwrap(),
            undefined
        );
        assert_eq!(
            evaluation
                .read(&result, |value| matches!(value, Value::Null))
                .unwrap(),
            !undefined
        );
    }
}

#[test]
// req:error-recovery-001 req:error-recovery-005 req:runtime-memory-005
fn callable_parameter_matching_shares_discovery_and_enabled_recovery_context() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let callable = CompiledExpression::new(Expression::Reference { name: "_".into() }).bind(
            mc,
            environment,
            Origin { start: 0, end: 0 },
            Pattern::Recover {
                pattern: Box::new(Pattern::Fail),
                skip: Box::new(Pattern::Any),
            },
        );
        let recovery = crate::runtime::input::RecoveryContext::new(mc);
        for enabled in [false, true] {
            let mut execution = ExpressionExecution::call_with_subject(
                mc,
                callable,
                vec![Value::Number(1.0)],
                environment,
                Origin { start: 0, end: 0 },
                Value::Null,
            );
            execution.set_recovery(if enabled { recovery.enable() } else { recovery });
            let result = loop {
                match execution.step(mc) {
                    Ok(true) => break Ok(()),
                    Ok(false) => {}
                    Err(error) => break Err(error),
                }
            };
            assert!(recovery.was_reached());
            if enabled {
                assert_eq!(result, Ok(()));
            } else {
                assert_eq!(result, Err(EvaluationError::LambdaArguments));
            }
        }
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-core-007 req:runtime-memory-005
fn rooted_serialization_keeps_original_value_and_resolves_authored_hooks() {
    let ast = expression(json!({
        "kind":"object","keys":[{
            "kind":"objectKey","name":"toJSON",
            "expression":{"kind":"lambda","pattern":{"kind":"any"},
                "expression":{"kind":"value","value":42}}
        }]
    }));
    let mut evaluation = Evaluation::new(ast);
    let original = evaluation.finish().unwrap();
    evaluation.collect();
    let serialized = evaluation.serialize_rooted(&original).unwrap();
    evaluation.collect();
    assert_eq!(
        evaluation
            .read(&serialized, |v| globals::json_text(v).unwrap())
            .unwrap(),
        Some("\"42\"".into())
    );
    assert!(
        evaluation
            .read(&original, |v| matches!(v, Value::Object(_)))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-004 req:runtime-core-012 req:runtime-memory-005
fn cyclic_array_conversion_fails_without_invoking_hooks_or_traversal() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let mutual = Value::array(mc, vec![]);
        let nested = Value::array(mc, vec![Value::Number(2.0), mutual, Value::Number(3.0)]);
        let Value::Array(array) = mutual else {
            unreachable!()
        };
        array
            .borrow_mut(mc)
            .extend([Value::Number(1.0), nested, Value::Number(4.0)]);
        for value in [mutual, Value::array(mc, vec![nested, nested])] {
            let mut execution = ExpressionExecution::call(
                mc,
                Value::Native(globals::NativeGlobal::Format),
                vec![Value::string(mc, "{0}"), value],
                environment,
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            let error = loop {
                match execution.step(mc) {
                    Err(error) => break error,
                    Ok(false) => {}
                    Ok(true) => panic!("composite formatting succeeded"),
                }
            };
            assert_eq!(
                error,
                EvaluationError::StringCoercion(StringCoercionError::CompositeConversion)
            );
            assert_eq!(
                crate::coercion::string_text(value),
                Err(StringCoercionError::CompositeConversion)
            );
        }
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn serialization_factory_retains_live_callable_hooks_and_undefined() {
    let mut arena = Arena::<Rootable![ExpressionExecution<'_>]>::new(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let value = Value::object(
            mc,
            vec![("toJSON".into(), Value::Native(globals::NativeGlobal::Id))],
        );
        ExpressionExecution::serialize(mc, value, environment, Origin { start: 0, end: 0 })
    });
    loop {
        let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate(|mc, execution| {
        let Value::String(text) = execution.result().unwrap().raw() else {
            unreachable!()
        };
        assert_eq!(*text, "\"\"");
        for value in [Value::Undefined] {
            let mut serialization = ExpressionExecution::serialize(
                mc,
                value,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
            );
            while !serialization.step(mc).unwrap() {}
            assert!(matches!(
                serialization.result().unwrap().raw(),
                Value::Undefined
            ));
        }
    });
}

#[test]
// req:expressions-runtime-004 req:into-001
fn interpolated_nonstring_conversion_takes_current_origin_not_input_origin() {
    let ast = expression(json!({"kind":"string","values":[{"kind":"reference","name":"number"}]}));
    let mut execution = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "number".into(),
                Value::Number(42.0).wrap(mc, Origin { start: 8, end: 9 }),
            )],
        )
    });
    let result = execution.finish().unwrap();
    assert_eq!(
        execution
            .read_with_provenance(&result, |value| value.char_origin(0))
            .unwrap(),
        Some(Origin { start: 0, end: 0 })
    );
}

#[test]
// req:expressions-runtime-005
fn absent_members_on_boxed_primitives_are_undefined_but_unimplemented_methods_fail() {
    for value in [json!(true), json!(42), json!("text"), json!([1, 2])] {
        let mut execution = Evaluation::new(expression(
            json!({"kind":"member","name":"missing","expression":{"kind":"value","value":value}}),
        ));
        let result = execution.finish().unwrap();
        assert!(
            execution
                .read(&result, |v| matches!(v, Value::Undefined))
                .unwrap()
        );
    }
    let mut execution = Evaluation::new(expression(
        json!({"kind":"member","name":"toString","expression":{"kind":"value","value":42}}),
    ));
    assert_eq!(
        execution.finish().unwrap_err(),
        EvaluationError::UnsupportedMember
    );
}

#[test]
// req:resolve-001 req:expressions-runtime-007 req:runtime-core-007 req:runtime-memory-005
fn lazy_callback_parameter_requests_suspend_and_resume_through_expression_execution() {
    use crate::pattern::ResolveTargetKind;
    let mut arena = Arena::<Rootable![ExpressionExecution<'_>]>::new(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let callback = CompiledExpression::new(Expression::Reference { name: "_".into() }).bind(
            mc,
            environment,
            Origin { start: 0, end: 0 },
            Pattern::Resolve {
                target_kind: ResolveTargetKind::Reference,
                name: Some("Item".into()),
                args: vec![],
                value: None,
            },
        );
        let NativeResult::Value(iterator) = globals::invoke(
            mc,
            globals::NativeGlobal::Map,
            vec![
                Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]),
                callback,
            ],
            Origin { start: 0, end: 0 },
        )
        .unwrap() else {
            unreachable!()
        };
        ExpressionExecution::collect_iterable(
            mc,
            iterator,
            environment,
            Origin { start: 0, end: 0 },
        )
        .unwrap()
    });
    let mut requests = 0;
    let mut yielded = 0;
    loop {
        let status = arena.mutate_root(|mc, execution| {
            if let Some(request) = execution.take_request() {
                requests += 1;
                assert_eq!(request.name.as_deref(), Some("Item"));
                assert!(
                    execution.step_status(mc).unwrap() == StepStatus::Suspended,
                    "actual resolver requests remain suspended until resumed"
                );
                let mut host = request.rule_execution(
                    mc,
                    crate::pattern::PatternProgram::compile(Pattern::Any),
                    request.environment,
                );
                while !host.step(mc).unwrap() {}
                execution
                    .resume_resolve(mc, host.result().unwrap())
                    .unwrap();
            }
            execution.step_status(mc).unwrap()
        });
        arena.finish_cycle();
        match status {
            StepStatus::Complete => break,
            StepStatus::Yielded => yielded += 1,
            StepStatus::Suspended => {}
        }
    }
    assert_eq!(requests, 2);
    assert!(yielded > 0);
    arena.mutate(|_, execution| {
        assert_eq!(
            globals::json_text(execution.result().unwrap())
                .unwrap()
                .unwrap(),
            "[1,2]"
        )
    });
}

#[test]
// req:runtime-core-007 req:expressions-runtime-007
fn data_then_properties_do_not_suspend_rust_execution() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = ExpressionExecution::new(
            mc,
            Expression::Value {
                value: Some(json!({"then":42}).into()),
            },
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
            Value::Undefined,
        );
        loop {
            match execution.step_status(mc).unwrap() {
                StepStatus::Complete => break,
                StepStatus::Yielded => {}
                StepStatus::Suspended => {
                    panic!("data then properties are not host resolver requests")
                }
            }
        }
        let Value::Object(object) = execution.result().unwrap().raw() else {
            panic!("expected a data object")
        };
        assert!(
            object
                .borrow()
                .get("then")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-core-007
fn standalone_unserviceable_parameter_reference_fails_instead_of_spinning() {
    let unresolved = json!({"kind":"lambda",
        "pattern":{"kind":"resolve","targetKind":"reference","name":"x","args":[]},
        "expression":{"kind":"value","value":42}});
    let cases = [
        json!({"kind":"invocation","expression":unresolved.clone(),"args":[]}),
        json!({"kind":"invocation","expression":{"kind":"reference","name":"json"},
            "args":[{"kind":"object","keys":[{"kind":"objectKey",
                "name":"toJSON","expression":unresolved}]}]}),
    ];
    for case in cases {
        let mut evaluation = Evaluation::new(expression(case));
        let mut outcome = None;
        for _ in 0..1_000 {
            match evaluation.step() {
                Ok(false) => evaluation.collect(),
                done => {
                    outcome = Some(done);
                    break;
                }
            }
        }
        let error = outcome.expect("bounded evaluation").unwrap_err();
        assert_eq!(
            error,
            EvaluationError::Pattern(PatternError::Expression(Box::new(
                EvaluationError::UnknownReference("x".into())
            )))
        );
        assert_eq!(error.to_string(), "lambda: unknown reference: x");
    }
}

#[test]
// req:expressions-runtime-007 req:projection-001
fn lambda_parameter_projection_preserves_original_expression_error() {
    let ast = expression(json!({
        "kind":"invocation","expression":{"kind":"lambda",
            "pattern":{"kind":"projection","pattern":{"kind":"any"},
                "expression":{"kind":"reference","name":"missing"}},
            "expression":{"kind":"reference","name":"_"}
        },"args":[{"kind":"value","value":1}]
    }));
    let mut execution = Evaluation::new(ast);
    assert_eq!(
        execution.finish().unwrap_err(),
        EvaluationError::UnknownReference("missing".into())
    );
}

#[test]
// req:expressions-runtime-010 req:rule-decorators-003 req:runtime-memory-005
fn explicit_invocation_subject_preserves_identity_without_mutating_closure_capture() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let captured = Value::object(mc, vec![("name".into(), Value::string(mc, "captured"))]);
        let explicit = Value::object(mc, vec![("name".into(), Value::string(mc, "explicit"))]);
        let callable = CompiledExpression::new(Expression::Reference {
            name: "this".into(),
        })
        .bind_subject(
            mc,
            environment,
            Origin { start: 0, end: 0 },
            Pattern::End,
            captured,
        );
        let mut execution = ExpressionExecution::call_with_subject(
            mc,
            callable,
            vec![],
            environment,
            Origin { start: 0, end: 0 },
            explicit,
        );
        while !execution.step(mc).unwrap() {}
        assert!(execution.result().unwrap().strict_eq(explicit));
        let mut execution = ExpressionExecution::call(
            mc,
            callable,
            vec![],
            environment,
            Origin { start: 0, end: 0 },
            Value::Undefined,
        );
        while !execution.step(mc).unwrap() {}
        assert!(execution.result().unwrap().strict_eq(captured));
    });
}

#[test]
// req:projection-001 req:pipeline-001 req:resolve-001 req:runtime-memory-005
fn lazy_callback_pipeline_projection_forwards_nested_expression_requests() {
    let ast = expression(json!({
        "kind":"array","expressions":[{"kind":"arraySpread","expression":{
            "kind":"invocation","expression":{"kind":"reference","name":"map"},"args":[
                {"kind":"value","value":[1,2]},
                {"kind":"lambda","pattern":{"kind":"pipeline","steps":[
                    {"kind":"projection","pattern":{"kind":"any"},"expression":{
                        "kind":"invocation","expression":{"kind":"lambda",
                            "pattern":{"kind":"resolve","targetKind":"reference","name":"Item"},
                            "expression":{"kind":"reference","name":"_"}
                        },"args":[{"kind":"reference","name":"_"}]
                    }},
                    {"kind":"any"}
                ]},"expression":{"kind":"reference","name":"_"}}
            ]
        }}]
    }));
    let mut arena = Arena::<Rootable![ExpressionExecution<'_>]>::new(|mc| {
        ExpressionExecution::new(
            mc,
            ast,
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
            Value::Undefined,
        )
    });
    let mut requests = 0;
    loop {
        let done = arena.mutate_root(|mc, execution| {
            if let Some(request) = execution.take_request() {
                requests += 1;
                assert_eq!(request.name.as_deref(), Some("Item"));
                assert!(!execution.step(mc).unwrap());
                let mut host = request.rule_execution(
                    mc,
                    crate::pattern::PatternProgram::compile(Pattern::Any),
                    request.environment,
                );
                while !host.step(mc).unwrap() {}
                execution
                    .resume_resolve(mc, host.result().unwrap())
                    .unwrap();
            }
            execution.step(mc).unwrap()
        });
        arena.finish_cycle();
        if done {
            break;
        }
    }
    assert_eq!(requests, 2);
    arena.mutate(|_, execution| {
        assert_eq!(
            globals::json_text(execution.result().unwrap())
                .unwrap()
                .unwrap(),
            "[1,2]"
        );
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-001 req:runtime-memory-005
fn shared_arena_executions_transfer_live_closures_and_collect_iterables() {
    use crate::pattern::Pattern;
    let body = expression(
        json!({"kind":"invocation","expression":{"kind":"reference","name":"add"},
        "args":[{"kind":"reference","name":"_"},{"kind":"number","value":1}]}),
    );
    let mut arena =
        Arena::<Rootable![(ExpressionExecution<'_>, Option<ExpressionExecution<'_>>)]>::new(|mc| {
            (
                ExpressionExecution::new(
                    mc,
                    Expression::Lambda {
                        pattern: Pattern::Any,
                        expression: Box::new(body),
                    },
                    Environment::new(mc, None, vec![]),
                    Origin { start: 0, end: 0 },
                    Value::Undefined,
                ),
                None,
            )
        });
    loop {
        let done = arena.mutate_root(|mc, (first, _)| first.step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate_root(|mc, (first, second)| {
        let env = Environment::new(mc, None, vec![("callback".into(), first.result().unwrap())]);
        let iterator = globals::invoke(
            mc,
            globals::NativeGlobal::Map,
            vec![
                Value::array(mc, vec![Value::Number(41.0), Value::Number(42.0)]),
                first.result().unwrap(),
            ],
            Origin { start: 0, end: 0 },
        )
        .unwrap();
        let NativeResult::Value(iterator) = iterator else {
            unreachable!()
        };
        *second = Some(
            ExpressionExecution::collect_iterable(mc, iterator, env, Origin { start: 0, end: 0 })
                .unwrap(),
        );
    });
    loop {
        let done = arena.mutate_root(|mc, (_, second)| second.as_mut().unwrap().step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate(|_, (_, second)| {
        assert_eq!(
            globals::json_text(second.as_ref().unwrap().result().unwrap())
                .unwrap()
                .unwrap(),
            "[42,43]"
        )
    });
}

#[test]
// req:expressions-runtime-010 req:expressions-runtime-005 req:expressions-runtime-007
fn current_match_reference_retains_identity_metadata_and_lambda_context() {
    uffda_heap::rootless_mutate(|mc| {
        let mut pattern = PatternExecution::new(
            mc,
            Pattern::Any,
            vec![Value::Number(42.0).wrap(mc, Origin { start: 10, end: 11 })],
            Environment::new(mc, None, vec![]),
        );
        while !pattern.step(mc).unwrap() {}
        let matched = pattern.result().unwrap();
        let ast = expression(json!({"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"reference","name":"this"}},
            {"kind":"arrayElement","expression":{"kind":"reference","name":"this"}}
        ]}));
        let mut execution = ExpressionExecution::with_match(mc, ast, matched);
        while !execution.step(mc).unwrap() {}
        let Value::Array(array) = execution.result().unwrap().raw() else {
            unreachable!()
        };
        assert!(array.borrow()[0].strict_eq(Value::Match(matched)));
        assert!(array.borrow()[0].strict_eq(array.borrow()[1]));
        let ast = expression(
            json!({"kind":"member","name":"originalSpan","expression":{"kind":"reference","name":"this"}}),
        );
        let mut execution = ExpressionExecution::with_match(mc, ast, matched);
        while !execution.step(mc).unwrap() {}
        assert_eq!(
            globals::json_text(execution.result().unwrap())
                .unwrap()
                .unwrap(),
            r#"{"start":10,"end":11}"#
        );
        let mut execution = ExpressionExecution::new(
            mc,
            expression(json!({"kind":"reference","name":"missing"})),
            matched.environment,
            matched.origin,
            matched.value,
        );
        let error = loop {
            if let Err(error) = execution.step(mc) {
                break error;
            }
        };
        assert_eq!(execution.step(mc).unwrap_err(), error);
        assert_eq!(execution.error(), Some(&error));
        assert!(execution.result().is_none());
    });
}

#[test]
// req:rule-decorators-003 req:expressions-runtime-010 req:expressions-runtime-007
fn decorated_closures_receive_explicit_subject_and_restore_callers_match_context() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let subject = Value::object(mc, vec![("name".into(), Value::string(mc, "Rule"))]);
        let compiled = CompiledExpression::new(expression(
            json!({"kind":"member","name":"name","expression":{"kind":"reference","name":"this"}}),
        ));
        let callable = compiled.bind_subject(
            mc,
            environment,
            Origin { start: 0, end: 0 },
            Pattern::End,
            subject,
        );
        let mut execution = ExpressionExecution::call(
            mc,
            callable,
            vec![],
            environment,
            Origin { start: 0, end: 0 },
            Value::Undefined,
        );
        while execution.pattern_execution().is_none() {
            assert!(!execution.step(mc).unwrap());
        }
        while !execution.step(mc).unwrap() {}
        assert_eq!(
            crate::coercion::string_text(execution.result().unwrap()).unwrap(),
            "Rule"
        );
    });
    let mut evaluation = Evaluation::new(expression(
        json!({"kind":"member","name":"kind","expression":{"kind":"reference","name":"this"}}),
    ));
    let result = evaluation.finish().unwrap();
    assert_eq!(
        evaluation
            .read(&result, crate::coercion::string_text)
            .unwrap()
            .unwrap(),
        "ok"
    );
}

fn expression(source: serde_json::Value) -> Expression {
    serde_json::from_value(source).unwrap()
}

fn snapshot(value: Value<'_>) -> serde_json::Value {
    match value.raw() {
        Value::Null => serde_json::Value::Null,
        Value::Boolean(value) => json!(value),
        Value::Number(value) => json!(value),
        Value::String(value) => json!(*value),
        Value::Array(values) => {
            serde_json::Value::Array(values.borrow().iter().copied().map(snapshot).collect())
        }
        Value::Object(properties) => serde_json::Value::Object(
            properties
                .borrow()
                .entries()
                .iter()
                .map(|(name, value)| {
                    (
                        name.to_utf8().expect("scalar fixture key"),
                        snapshot(*value),
                    )
                })
                .collect(),
        ),
        Value::Undefined => panic!("undefined must be checked directly, not flattened into JSON"),
        Value::Lambda(_)
        | Value::Native(_)
        | Value::Host(_)
        | Value::InputSource(_)
        | Value::IteratorFactory(_)
        | Value::Symbol(_)
        | Value::BigInt(_)
        | Value::Date(_)
        | Value::Error(_)
        | Value::Iterable(_)
        | Value::Declaration(_)
        | Value::Url(_)
        | Value::Set(_)
        | Value::Map(_)
        | Value::Bytes(_)
        | Value::Match(_) => panic!("non-JSON values must be checked directly"),
        Value::Located(_) => unreachable!("wrappers cannot contain wrappers"),
    }
}

fn finish_with_collection(evaluation: &mut Evaluation) -> RootedValue {
    loop {
        let done = evaluation.step().unwrap();
        evaluation.collect();
        if done {
            break;
        }
    }
    evaluation.finish().unwrap()
}

fn assert_json_values(actual: &serde_json::Value, expected: &serde_json::Value) {
    match (actual, expected) {
        (serde_json::Value::Number(actual), serde_json::Value::Number(expected)) => {
            assert_eq!(actual.as_f64(), expected.as_f64());
        }
        (serde_json::Value::Array(actual), serde_json::Value::Array(expected)) => {
            assert_eq!(actual.len(), expected.len());
            for (actual, expected) in actual.iter().zip(expected) {
                assert_json_values(actual, expected);
            }
        }
        (serde_json::Value::Object(actual), serde_json::Value::Object(expected)) => {
            assert_eq!(actual.len(), expected.len());
            for (key, value) in expected {
                assert_json_values(actual.get(key).expect("missing property"), value);
            }
        }
        _ => assert_eq!(actual, expected),
    }
}

#[test]
// req:expressions-runtime-003 req:expressions-runtime-005 req:expressions-runtime-006
// req:expressions-runtime-004 req:expressions-runtime-007
// req:runtime-memory-005
fn shared_fixtures_match_the_typescript_runtime_with_collection_at_every_step() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../test/rust/expression-fixtures.json")).unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let mut evaluation = Evaluation::new(expression(fixture["ast"].clone()));
        if fixture["error"].as_bool() == Some(true) {
            assert!(evaluation.finish().is_err(), "{}", fixture["name"]);
            continue;
        }
        let result = finish_with_collection(&mut evaluation);
        let actual = evaluation.read(&result, snapshot).unwrap();
        assert_json_values(&actual, &fixture["expected"]);
    }
}

#[test]
// req:expressions-runtime-003 req:runtime-memory-005
fn numeric_literals_preserve_nan_infinity_and_signed_zero() {
    for number in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, -0.0] {
        let mut evaluation = Evaluation::new(Expression::Number { value: number });
        let result = finish_with_collection(&mut evaluation);
        evaluation
            .read(&result, |value| {
                let Value::Number(actual) = value else {
                    panic!("expected number");
                };
                if number.is_nan() {
                    assert!(actual.is_nan());
                } else {
                    assert_eq!(actual.to_bits(), number.to_bits());
                }
            })
            .unwrap();
    }
}

#[test]
// req:expressions-runtime-005 req:runtime-memory-004 req:runtime-memory-005
fn references_keep_undefined_bindings_and_shared_object_identity() {
    let ast = expression(json!({"kind":"array","expressions":[
        {"kind":"arrayElement","expression":{"kind":"reference","name":"value"}},
        {"kind":"arrayElement","expression":{"kind":"reference","name":"value"}},
        {"kind":"arrayElement","expression":{"kind":"reference","name":"absent"}}
    ]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![
                (
                    "value".into(),
                    Value::object(mc, vec![("answer".into(), Value::Number(42.0))]),
                ),
                ("absent".into(), Value::Undefined),
            ],
        )
    });
    let result = finish_with_collection(&mut evaluation);
    evaluation
        .read(&result, |value| {
            let Value::Array(values) = value else {
                panic!("expected array");
            };
            let values = values.borrow();
            assert!(values[0].strict_eq(values[1]));
            assert!(values[2].strict_eq(Value::Undefined));
        })
        .unwrap();
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-006 req:runtime-memory-005
fn child_errors_are_sticky_and_follow_declaration_order() {
    let mut evaluation = Evaluation::new(expression(json!({"kind":"array","expressions":[
        {"kind":"arrayElement","expression":{"kind":"reference","name":"first"}},
        {"kind":"arrayElement","expression":{"kind":"reference","name":"second"}}
    ]})));
    let expected = EvaluationError::UnknownReference("first".into());
    assert_eq!(evaluation.finish().unwrap_err(), expected);
    evaluation.collect();
    assert_eq!(evaluation.step().unwrap_err(), expected);
    assert_eq!(evaluation.finish().unwrap_err(), expected);
}

#[test]
// req:expressions-runtime-006
fn computed_key_evaluates_before_its_value() {
    let mut evaluation = Evaluation::new(expression(json!({"kind":"object","keys":[
        {"kind":"objectComputedKey",
         "keyExpression":{"kind":"reference","name":"key"},
         "expression":{"kind":"reference","name":"value"}}
    ]})));
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference("key".into())
    );
}

#[test]
// req:expressions-runtime-005
fn absent_properties_remain_undefined_and_nullish_bases_fail() {
    let mut evaluation = Evaluation::new(expression(json!({
        "kind":"member","name":"missing","expression":{"kind":"value","value":{}}
    })));
    let result = finish_with_collection(&mut evaluation);
    assert!(
        evaluation
            .read(&result, |value| value.strict_eq(Value::Undefined))
            .unwrap()
    );
    for reference in ["null", "undefined"] {
        let mut evaluation = Evaluation::with_environment(
            expression(
                json!({"kind":"member","name":"x","expression":{"kind":"reference","name":reference}}),
            ),
            |mc| {
                Environment::new(
                    mc,
                    None,
                    vec![
                        ("null".into(), Value::Null),
                        ("undefined".into(), Value::Undefined),
                    ],
                )
            },
        );
        assert_eq!(
            evaluation.finish().unwrap_err(),
            EvaluationError::NullishMember("x".into())
        );
    }
}

#[test]
// req:expressions-runtime-006
fn invalid_spreads_and_computed_keys_are_errors() {
    for literal in [json!(null), json!(true), json!(42), json!({})] {
        let mut evaluation = Evaluation::new(expression(json!({
            "kind":"array","expressions":[{"kind":"arraySpread","expression":{"kind":"value","value":literal}}]
        })));
        assert_eq!(
            evaluation.finish().unwrap_err(),
            EvaluationError::NotIterable
        );
    }
    for literal in [json!(null), json!(true), json!([]), json!({})] {
        let mut evaluation = Evaluation::new(expression(json!({
            "kind":"object","keys":[{"kind":"objectComputedKey",
                "keyExpression":{"kind":"value","value":literal},
                "expression":{"kind":"number","value":42}}]
        })));
        assert_eq!(
            evaluation.finish().unwrap_err(),
            EvaluationError::InvalidPropertyKey
        );
    }
}

#[test]
// req:expressions-runtime-006 req:runtime-memory-005
fn nested_expression_execution_does_not_use_the_host_call_stack() {
    let mut ast = Expression::Number { value: 42.0 };
    for _ in 0..20_000 {
        ast = Expression::Array {
            expressions: vec![ArrayInitializer::ArrayElement { expression: ast }],
        };
    }
    let mut evaluation = Evaluation::new(ast);
    let result = evaluation.finish().unwrap();
    evaluation.collect();
    evaluation
        .read(&result, |mut value| {
            for _ in 0..20_000 {
                let Value::Array(array) = value.raw() else {
                    panic!("expected array");
                };
                value = array.borrow()[0];
            }
            assert!(value.strict_eq(Value::Number(42.0)));
        })
        .unwrap();
}

#[test]
// req:runtime-memory-003 req:runtime-memory-005
fn retained_evaluation_results_are_rooted_and_runtime_isolated() {
    let mut evaluation = Evaluation::new(Expression::Number { value: 42.0 });
    let result = finish_with_collection(&mut evaluation);
    let again = evaluation.finish().unwrap();
    evaluation.collect();
    assert!(
        evaluation
            .read(&result, |value| value.strict_eq(Value::Number(42.0)))
            .unwrap()
    );
    assert!(
        evaluation
            .read(&again, |value| value.strict_eq(Value::Number(42.0)))
            .unwrap()
    );
    let other = Evaluation::new(Expression::Boolean { value: true });
    assert_eq!(
        other.read(&result, |_| ()).unwrap_err(),
        EvaluationError::ForeignRoot
    );
}

#[test]
// req:runtime-memory-002 req:runtime-memory-005
fn failure_releases_intermediate_allocations() {
    let ast = expression(json!({"kind":"array","expressions":[
        {"kind":"arrayElement","expression":{"kind":"value","value":[{"value":[1,2,3]}]}},
        {"kind":"arrayElement","expression":{"kind":"reference","name":"missing"}}
    ]}));
    let mut evaluation = Evaluation::new(ast);
    evaluation.collect();
    let baseline = evaluation.arena.metrics().total_gc_count();
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference("missing".into())
    );
    evaluation.collect();
    assert_eq!(evaluation.arena.metrics().total_gc_count(), baseline);
}

fn deep_array() -> Expression {
    let mut ast = Expression::Number { value: 42.0 };
    for _ in 0..20_000 {
        ast = Expression::Array {
            expressions: vec![ArrayInitializer::ArrayElement { expression: ast }],
        };
    }
    ast
}

#[test]
// req:runtime-memory-005
fn abandoned_and_failed_evaluations_discard_deep_pending_trees_iteratively() {
    drop(Evaluation::new(deep_array()));
    let mut evaluation = Evaluation::new(Expression::Array {
        expressions: vec![
            ArrayInitializer::ArrayElement {
                expression: Expression::Reference {
                    name: "missing".into(),
                },
            },
            ArrayInitializer::ArrayElement {
                expression: deep_array(),
            },
        ],
    });
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference("missing".into())
    );
}

#[test]
// req:expressions-runtime-004 req:runtime-memory-005
fn interpolation_preserves_undefined_and_collection_roots() {
    let ast = Expression::String {
        values: vec![
            crate::expression::StringSegment::Literal("value=".into()),
            crate::expression::StringSegment::Expression(Expression::Reference {
                name: "value".into(),
            }),
        ],
    };
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("value".into(), Value::Undefined)])
    });
    let result = finish_with_collection(&mut evaluation);
    assert_eq!(
        evaluation.read(&result, snapshot).unwrap(),
        json!("value=undefined")
    );
}

#[test]
// req:expressions-runtime-004 req:expressions-runtime-007
fn string_and_not_propagate_child_errors() {
    for ast in [
        Expression::Not {
            expression: Box::new(Expression::Reference {
                name: "missing".into(),
            }),
        },
        Expression::String {
            values: vec![
                crate::expression::StringSegment::Expression(Expression::Reference {
                    name: "missing".into(),
                }),
                crate::expression::StringSegment::Expression(Expression::Reference {
                    name: "later".into(),
                }),
            ],
        },
    ] {
        let mut evaluation = Evaluation::new(ast);
        assert_eq!(
            evaluation.finish().unwrap_err(),
            EvaluationError::UnknownReference("missing".into())
        );
    }
}

#[test]
// req:expressions-runtime-004
fn string_conversion_failure_is_not_a_success_shaped_result() {
    let mut evaluation = Evaluation::new(expression(json!({
        "kind":"string","values":[{"kind":"value","value":{"toString":42}}]
    })));
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::StringCoercion(crate::coercion::StringCoercionError::CompositeConversion)
    );
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn deeply_nested_negation_executes_and_cleans_up_iteratively() {
    let mut ast = Expression::Boolean { value: true };
    for _ in 0..20_000 {
        ast = Expression::Not {
            expression: Box::new(ast),
        };
    }
    let mut evaluation = Evaluation::new(ast);
    let result = evaluation.finish().unwrap();
    evaluation.collect();
    assert!(
        evaluation
            .read(&result, |value| value.strict_eq(Value::Boolean(true)))
            .unwrap()
    );
    let mut ast = Expression::Boolean { value: true };
    for _ in 0..20_000 {
        ast = Expression::Not {
            expression: Box::new(ast),
        };
    }
    drop(Evaluation::new(ast));
}

#[test]
// req:expressions-runtime-004 req:runtime-memory-005
fn deeply_nested_strings_execute_and_abandoned_strings_cleanup_iteratively() {
    fn tree() -> Expression {
        let mut ast = Expression::Number { value: 42.0 };
        for _ in 0..20_000 {
            ast = Expression::String {
                values: vec![crate::expression::StringSegment::Expression(ast)],
            };
        }
        ast
    }
    let mut evaluation = Evaluation::new(tree());
    let result = evaluation.finish().unwrap();
    evaluation.collect();
    assert_eq!(evaluation.read(&result, snapshot).unwrap(), json!("42"));
    drop(Evaluation::new(tree()));
}

fn invocation(callee: Expression, args: Vec<Expression>) -> Expression {
    Expression::Invocation {
        expression: Box::new(callee),
        args: args
            .into_iter()
            .map(crate::expression::InvocationArgument::Expression)
            .collect(),
    }
}

fn lambda(pattern: crate::pattern::Pattern, body: Expression) -> Expression {
    Expression::Lambda {
        pattern,
        expression: Box::new(body),
    }
}

#[test]
// req:expressions-runtime-007 req:runtime-core-011 req:runtime-memory-003 req:runtime-memory-005
fn lambda_invocation_matches_arguments_and_uses_captured_lexical_bindings() {
    use crate::pattern::Pattern;
    let ast = invocation(
        lambda(
            Pattern::Variable {
                name: "argument".into(),
                pattern: Box::new(Pattern::Any),
            },
            Expression::Array {
                expressions: vec![
                    ArrayInitializer::ArrayElement {
                        expression: Expression::Reference {
                            name: "captured".into(),
                        },
                    },
                    ArrayInitializer::ArrayElement {
                        expression: Expression::Reference {
                            name: "argument".into(),
                        },
                    },
                ],
            },
        ),
        vec![Expression::Number { value: 7.0 }],
    );
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("captured".into(), Value::Number(42.0))])
    });
    let result = finish_with_collection(&mut evaluation);
    assert_json_values(
        &evaluation.read(&result, snapshot).unwrap(),
        &json!([42, 7]),
    );
    assert!(
        evaluation
            .arena
            .mutate(|_, state| state.environment.get("argument").is_none())
    );
}

#[test]
// req:expressions-runtime-007 req:runtime-core-011
fn lambda_failures_and_child_errors_remain_sticky_and_do_not_return_values() {
    use crate::pattern::Pattern;
    for (ast, expected) in [
        (
            invocation(
                lambda(Pattern::Fail, Expression::Number { value: 42.0 }),
                vec![],
            ),
            EvaluationError::LambdaArguments,
        ),
        (
            invocation(
                lambda(
                    Pattern::Any,
                    Expression::Reference {
                        name: "missing".into(),
                    },
                ),
                vec![Expression::Number { value: 42.0 }],
            ),
            EvaluationError::UnknownReference("missing".into()),
        ),
        (
            invocation(Expression::Number { value: 42.0 }, vec![]),
            EvaluationError::NotCallable,
        ),
        (
            invocation(
                Expression::Reference {
                    name: "callee".into(),
                },
                vec![Expression::Reference {
                    name: "argument".into(),
                }],
            ),
            EvaluationError::UnknownReference("callee".into()),
        ),
    ] {
        let mut evaluation = Evaluation::new(ast);
        assert_eq!(evaluation.finish().unwrap_err(), expected);
        evaluation.collect();
        assert_eq!(evaluation.finish().unwrap_err(), expected);
    }
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn twenty_thousand_nested_calls_do_not_clone_or_recurse_through_host_stack() {
    use crate::pattern::Pattern;
    let mut ast = Expression::Number { value: 42.0 };
    for _ in 0..20_000 {
        ast = invocation(
            lambda(Pattern::Any, Expression::Reference { name: "_".into() }),
            vec![ast],
        );
    }
    let mut evaluation = Evaluation::new(ast);
    let mut steps = 0;
    loop {
        let done = evaluation.step().unwrap();
        steps += 1;
        if steps % 1000 == 0 {
            evaluation.collect();
        }
        if done {
            break;
        }
    }
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| value.strict_eq(Value::Number(42.0)))
            .unwrap()
    );
}

#[test]
// req:into-001 req:expressions-runtime-007 req:runtime-memory-003 req:runtime-memory-005
fn lambda_selection_preserves_wrapper_identity_and_computation_uses_argument_span() {
    use crate::pattern::Pattern;
    use crate::provenance::Origin;
    for (body, carried) in [
        (Expression::Reference { name: "_".into() }, true),
        (
            Expression::Not {
                expression: Box::new(Expression::Reference { name: "_".into() }),
            },
            false,
        ),
    ] {
        let ast = invocation(
            lambda(Pattern::Any, body),
            vec![Expression::Reference {
                name: "input".into(),
            }],
        );
        let mut evaluation = Evaluation::with_environment(ast, |mc| {
            Environment::new(
                mc,
                None,
                vec![(
                    "input".into(),
                    Value::Number(42.0).wrap(mc, Origin { start: 8, end: 11 }),
                )],
            )
        });
        let result = finish_with_collection(&mut evaluation);
        evaluation.arena.mutate(|_, state| {
            let value = *state.external.fetch(&result.0);
            assert_eq!(value.origin(), Some(Origin { start: 8, end: 11 }));
            assert_eq!(
                value.same_wrapper(state.environment.get("input").unwrap()),
                carried
            );
        });
    }
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-002 req:runtime-memory-003
fn real_closure_environment_cycle_is_reclaimed_after_external_roots_are_released() {
    use crate::pattern::Pattern;
    let mut evaluation = Evaluation::with_environment(
        lambda(
            Pattern::Ok,
            Expression::Reference {
                name: "object".into(),
            },
        ),
        |mc| Environment::new(mc, None, vec![("object".into(), Value::object(mc, vec![]))]),
    );
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate_root(|mc, state| {
        let value = *state.external.fetch(&result.0);
        let Value::Object(object) = state.environment.get("object").unwrap() else {
            panic!("object")
        };
        object.borrow_mut(mc).set("closure".into(), value);
        state.environment = Environment::new(mc, None, vec![]);
    });
    evaluation.collect();
    let retained = evaluation.arena.metrics().total_gc_count();
    evaluation.result = None;
    drop(result);
    evaluation.collect();
    assert!(evaluation.arena.metrics().total_gc_count() < retained);
}

#[test]
// req:runtime-memory-002 req:runtime-memory-005 req:expressions-runtime-007
fn failed_lambda_body_unwinds_context_and_releases_parameter_allocations() {
    use crate::pattern::Pattern;
    let ast = invocation(
        lambda(
            Pattern::Variable {
                name: "temporary".into(),
                pattern: Box::new(Pattern::Any),
            },
            Expression::Reference {
                name: "missing".into(),
            },
        ),
        vec![Expression::Value {
            value: Some(json!({"nested":[1,2,3]}).into()),
        }],
    );
    let mut evaluation = Evaluation::new(ast);
    evaluation.collect();
    let baseline = evaluation.arena.metrics().total_gc_count();
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference("missing".into())
    );
    evaluation.collect();
    assert_eq!(evaluation.arena.metrics().total_gc_count(), baseline);
    assert!(
        evaluation
            .arena
            .mutate(|_, state| state.environment.get("temporary").is_none())
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-007
fn current_value_reference_is_reserved_and_ignores_an_underscore_binding() {
    use crate::pattern::Pattern;
    let ast = invocation(
        lambda(Pattern::Any, Expression::Reference { name: "_".into() }),
        vec![Expression::Number { value: 42.0 }],
    );
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("_".into(), Value::Number(7.0))])
    });
    let result = finish_with_collection(&mut evaluation);
    assert!(
        evaluation
            .read(&result, |value| value.strict_eq(Value::Number(42.0)))
            .unwrap()
    );
}

#[test]
// req:into-001 req:expressions-runtime-007
fn zero_argument_lambda_uses_the_captured_input_origin_as_its_base() {
    use crate::pattern::Pattern;
    let ast = invocation(
        invocation(
            lambda(
                Pattern::Any,
                lambda(Pattern::Ok, Expression::Number { value: 7.0 }),
            ),
            vec![Expression::Reference {
                name: "input".into(),
            }],
        ),
        vec![],
    );
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "input".into(),
                Value::Number(42.0).wrap(mc, Origin { start: 8, end: 11 }),
            )],
        )
    });
    let result = finish_with_collection(&mut evaluation);
    assert_eq!(
        evaluation
            .read_with_provenance(&result, |value| value.origin())
            .unwrap(),
        Some(Origin { start: 8, end: 8 })
    );
}

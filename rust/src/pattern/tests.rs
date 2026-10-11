use super::*;
use gc_arena::{Arena, Rootable};
use serde_json::json;

#[test]
// req:runtime-strings-002
fn literal_bounds_regex_and_character_classes_accept_lossless_subjects() {
    let subject: crate::json::JsonValue = crate::json::from_str(r#""\ud800""#).unwrap();
    for source in [
        r#"{"kind":"equal","value":{"kind":"value.literal","value":"\ud800"}}"#,
        r#"{"kind":"between","left":{"kind":"value.literal","value":"\ud800"},"right":{"kind":"value.literal","value":"\udfff"}}"#,
        r#"{"kind":"character","characterClass":"Cs"}"#,
        r#"{"kind":"regexp","pattern":{"source":"\ud800","flags":"u"}}"#,
    ] {
        let mut runtime = crate::runtime::Runtime::for_pattern(
            crate::json::from_str(source).unwrap(),
            subject.clone(),
            crate::runtime::InputMode::Iterable,
        )
        .unwrap();
        runtime.run().unwrap();
        assert_eq!(
            runtime.read(|execution| execution.result().unwrap().kind),
            MatchKind::Ok,
            "{source}"
        );
    }
}

fn literal(value: serde_json::Value) -> Pattern {
    Pattern::Equal {
        value: ValueSource::Literal {
            value: LiteralValue::Present(value.into()),
        },
    }
}

#[test]
// req:runtime-core-013
fn pattern_owned_projections_and_into_forward_and_resume_host_calls() {
    for projection in [true, false] {
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            let host = Value::host(
                mc,
                crate::value::HostCallable {
                    id: 1,
                    name: "host".into(),
                    arity: 0,
                },
            );
            let (pattern, input) = if projection {
                (serde_json::from_value(json!({
                    "kind":"projection","pattern":{"kind":"ok"},
                    "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},"args":[]}
                })).unwrap(), vec![])
            } else {
                let source = Value::object(mc, vec![]);
                let Value::Object(object) = source else {
                    unreachable!()
                };
                object.borrow_mut(mc).set_symbol("iterator".into(), host);
                (
                    Pattern::Into {
                        pattern: Box::new(Pattern::Any),
                    },
                    vec![source],
                )
            };
            PatternExecution::new(
                mc,
                pattern,
                input,
                Environment::new(mc, None, vec![("host".into(), host)]),
            )
        });
        let mut request = None;
        for _ in 0..100 {
            let step = arena.mutate_root(|mc, state| state.step_status(mc).unwrap());
            arena.finish_cycle();
            match step {
                StepStatus::Suspended => {
                    request = arena.mutate_root(|mc, state| state.take_host_request(mc));
                    break;
                }
                StepStatus::Complete => panic!("host call unexpectedly completed"),
                StepStatus::Yielded => {}
            }
        }
        let request = request.expect("host request must surface");
        arena.finish_cycle();
        arena.mutate_root(|mc, state| {
            assert_eq!(state.step_status(mc).unwrap(), StepStatus::Suspended);
            assert!(state.take_request().is_none());
            assert!(state.take_host_request(mc).is_none());
            state
                .complete_host(
                    mc,
                    &request,
                    Ok(HostCompletion::materialize(vec![], move |mc, _| {
                        Ok(if projection {
                            Value::array(mc, vec![Value::Number(42.0)])
                        } else {
                            Value::Iterable(Gc::new(
                                mc,
                                RefLock::new(crate::globals::IterableState::Source {
                                    value: Value::array(mc, vec![Value::Number(42.0)]),
                                    index: 0,
                                    offset: 0,
                                }),
                            ))
                        })
                    })),
                )
                .unwrap();
        });
        for _ in 0..100 {
            if arena.mutate_root(|mc, state| state.step(mc).unwrap()) {
                break;
            }
            arena.finish_cycle();
        }
        arena.mutate(|_, state| assert_eq!(state.result().unwrap().kind, MatchKind::Ok));
    }
}

#[test]
// req:runtime-core-013 req:runtime-memory-002
fn pattern_cancellation_releases_suspended_projection_argument_cycle() {
    let mut arena = Arena::<
        Rootable![(
            PatternExecution<'_>,
            gc_arena::GcWeak<'_, RefLock<crate::value::ObjectProperties<'_>>>
        )],
    >::new(|mc| {
        let argument = Value::object(mc, vec![]);
        let Value::Object(object) = argument else {
            unreachable!()
        };
        object.borrow_mut(mc).set("self".into(), argument);
        let host = Value::host(
            mc,
            crate::value::HostCallable {
                id: 1,
                name: "host".into(),
                arity: 1,
            },
        );
        let pattern = serde_json::from_value(json!({
            "kind":"projection","pattern":{"kind":"any"},
            "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},
                "args":[{"kind":"reference","name":"_"}]}
        }))
        .unwrap();
        (
            PatternExecution::new(
                mc,
                pattern,
                vec![argument],
                Environment::new(mc, None, vec![("host".into(), host)]),
            ),
            Gc::downgrade(object),
        )
    });
    let mut request = None;
    for _ in 0..100 {
        request = arena.mutate_root(|mc, (state, _)| {
            state.step_status(mc).unwrap();
            state.take_host_request(mc)
        });
        if request.is_some() {
            break;
        }
    }
    let request = request.unwrap();
    arena.mutate_root(|_, (state, _)| state.cancel());
    arena.finish_cycle();
    arena.mutate(|mc, (_, weak)| assert!(weak.upgrade(mc).is_some()));
    drop(request);
    arena.finish_cycle();
    arena.mutate(|mc, (_, weak)| assert!(weak.upgrade(mc).is_none()));
    arena.mutate_root(|mc, (state, _)| {
        assert!(state.frames.is_empty());
        assert!(state.pending_request.is_none());
        assert_eq!(
            state.step(mc),
            Err(PatternError::Expression(Box::new(
                EvaluationError::Cancelled
            )))
        );
    });
}

#[test]
// req:runtime-core-014
fn direct_pattern_source_preserves_continuation_and_does_not_prefetch_zero_width_patterns() {
    for zero_width in [false, true] {
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            let pattern = if zero_width {
                Pattern::Ok
            } else {
                Pattern::Any
            };
            let source = crate::runtime::input::InputSource::new(
                mc,
                crate::runtime::input::Source {
                    id: 1,
                    name: "source".into(),
                },
            );
            PatternExecution::from_source(mc, pattern, source, Environment::new(mc, None, vec![]))
        });
        let status = arena.mutate_root(|mc, state| state.step_status(mc).unwrap());
        if zero_width {
            assert_eq!(status, StepStatus::Complete);
            assert!(
                arena
                    .mutate_root(|mc, state| state.take_input_request(mc))
                    .is_none()
            );
        } else {
            assert_eq!(status, StepStatus::Suspended);
            let request = arena.mutate_root(|mc, state| state.take_input_request(mc).unwrap());
            arena.finish_cycle();
            arena.mutate_root(|mc, state| {
                assert!(state.result().is_none());
                assert_eq!(state.step_status(mc).unwrap(), StepStatus::Suspended);
                state
                    .complete_input(
                        mc,
                        &request,
                        Ok(crate::runtime::input::InputCompletion::Item(
                            HostCompletion::materialize(vec![], |mc, _| {
                                Ok(Value::object(mc, vec![("ok".into(), Value::Boolean(true))]))
                            }),
                        )),
                    )
                    .unwrap();
                assert_eq!(state.step_status(mc).unwrap(), StepStatus::Complete);
            });
            arena.finish_cycle();
            arena.mutate(|_, state| {
                assert_eq!(
                    state.result().unwrap().value.runtime_type(),
                    RuntimeType::Object
                )
            });
        }
    }
}

fn run(pattern: Pattern, input: Vec<f64>) -> (MatchKind, usize) {
    let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
        PatternExecution::new(
            mc,
            pattern,
            input.into_iter().map(Value::Number).collect(),
            Environment::new(mc, None, vec![]),
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
        let result = execution.result().unwrap();
        (result.kind, result.end)
    })
}

fn finish<'gc>(mc: &Mutation<'gc>, execution: &mut PatternExecution<'gc>) {
    while !execution.step(mc).unwrap() {}
}

#[test]
// req:resolve-001 req:runtime-memory-005
fn resolve_suspends_and_resumes_with_host_match_and_argument_patterns() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern = Pattern::Resolve {
            target_kind: ResolveTargetKind::Reference,
            name: Some("Token".into()),
            args: vec![Pattern::Any],
            value: None,
        };
        let mut execution = PatternExecution::new(
            mc,
            pattern,
            vec![Value::string(mc, "a"), Value::string(mc, "b")],
            environment,
        );
        assert!(!execution.step(mc).unwrap());
        let request = execution.take_request().unwrap();
        assert_eq!(request.name.as_deref(), Some("Token"));
        assert_eq!(request.position, 0);
        assert_eq!(request.stream.len(), 2);
        let input = request.input();
        assert!(input.stream.same_storage(request.stream));
        assert_eq!(input.position, request.position);
        assert_eq!(input.base, request.base);
        let mut shared = PatternExecution::from_input(mc, Pattern::Any, input, environment);
        finish(mc, &mut shared);
        assert_eq!(shared.result().unwrap().end, 1);
        assert!(!execution.step(mc).unwrap());

        let argument = request.argument_program(0).unwrap();
        assert_eq!(argument.resolve_info(), None);
        let mut argument = argument.execution(
            mc,
            vec![Value::string(mc, "invocation-argument")],
            environment,
            0,
        );
        finish(mc, &mut argument);
        assert_eq!(argument.result().unwrap().kind, MatchKind::Ok);

        let mut host =
            request.rule_execution(mc, PatternProgram::compile(Pattern::Any), environment);
        finish(mc, &mut host);
        execution
            .resume_resolve(mc, host.result().unwrap())
            .unwrap();
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.value.strict_eq(Value::string(mc, "a")));
    });
}

#[test]
// req:projection-001 req:pipeline-001 req:runtime-memory-005
fn projection_and_pipeline_await_expression_and_child_execution() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let projection: Pattern = serde_json::from_value(json!({
            "kind": "projection",
            "pattern": { "kind": "any" },
            "expression": { "kind": "value", "value": 99 }
        }))
        .unwrap();
        let mut execution = PatternExecution::new(
            mc,
            projection,
            vec![Value::string(mc, "source")],
            environment,
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.value.strict_eq(Value::Number(99.0)));
        assert_eq!(result.children.len(), 1);

        let pipeline: Pattern = serde_json::from_value(json!({
            "kind": "pipeline",
            "steps": [
                { "kind": "any" },
                {
                    "kind": "equal",
                    "value": { "kind": "value.literal", "value": "source" }
                }
            ]
        }))
        .unwrap();
        let mut execution = PatternExecution::new(
            mc,
            pipeline,
            vec![Value::string(mc, "source"), Value::string(mc, "tail")],
            environment,
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.value.strict_eq(Value::string(mc, "source")));
        assert_eq!(result.children.len(), 2);
    });
}

#[test]
// req:projection-001 req:resolve-001 req:runtime-memory-005
fn projection_forwards_nested_lambda_resolve_requests() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "projection",
            "pattern": { "kind": "any" },
            "expression": {
                "kind": "invocation",
                "expression": {
                    "kind": "lambda",
                    "pattern": {
                        "kind": "resolve",
                        "targetKind": "reference",
                        "name": "Token",
                        "args": []
                    },
                    "expression": { "kind": "value", "value": 7 }
                },
                "args": [{ "kind": "value", "value": "argument" }]
            }
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "source")], environment);
        while execution.take_request().is_none() {
            assert!(!execution.step(mc).unwrap());
        }
        let request = execution.take_request().unwrap();
        assert_eq!(request.name.as_deref(), Some("Token"));
        assert_eq!(request.stream.len(), 1);

        let mut host =
            request.rule_execution(mc, PatternProgram::compile(Pattern::Any), environment);
        finish(mc, &mut host);
        execution
            .resume_resolve(mc, host.result().unwrap())
            .unwrap();
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.strict_eq(Value::Number(7.0)));
    });
}

#[test]
// req:error-recovery-001 req:error-recovery-005
fn recover_discovers_failure_then_skips_during_recovery_pass() {
    #[derive(Collect)]
    #[collect(no_drop)]
    struct Root<'gc> {
        execution: Option<PatternExecution<'gc>>,
        recovery: RecoveryContext<'gc>,
        environment: Environment<'gc>,
    }
    fn pattern() -> Pattern {
        Pattern::Recover {
            pattern: Box::new(literal(json!(2))),
            skip: Box::new(Pattern::Any),
        }
    }

    let mut arena = Arena::<Rootable![Root<'_>]>::new(|mc| {
        let recovery = RecoveryContext::new(mc);
        let environment = Environment::new(mc, None, vec![]);
        Root {
            execution: Some(PatternExecution::new_with_recovery(
                mc,
                pattern(),
                vec![Value::Number(1.0)],
                environment,
                recovery,
            )),
            recovery,
            environment,
        }
    });
    loop {
        let done = arena.mutate_root(|mc, root| root.execution.as_mut().unwrap().step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate_root(|mc, root| {
        assert_eq!(
            root.execution.as_ref().unwrap().result().unwrap().kind,
            MatchKind::Fail
        );
        assert!(root.recovery.was_reached());
        root.execution = Some(PatternExecution::new_with_recovery(
            mc,
            pattern(),
            vec![Value::Number(1.0)],
            root.environment,
            root.recovery.enable(),
        ));
    });
    loop {
        let done = arena.mutate_root(|mc, root| root.execution.as_mut().unwrap().step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate(|_, root| {
        let result = root.execution.as_ref().unwrap().result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.recovered);
        assert_eq!(result.pattern_kind, PatternKind::Recover);
        assert_eq!(result.children[0].kind, MatchKind::Fail);
    });
}

#[test]
// req:error-recovery-002 req:skip-002 req:runtime-memory-005
fn skipped_recovery_preserves_kind_and_is_omitted_from_repetition_values() {
    fn recovery() -> Pattern {
        Pattern::Recover {
            pattern: Box::new(literal(json!(2))),
            skip: Box::new(Pattern::Skip {
                pattern: Box::new(Pattern::Any),
            }),
        }
    }
    for repeated in [false, true] {
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            PatternExecution::new_with_recovery(
                mc,
                if repeated {
                    Pattern::Quantifier {
                        pattern: Box::new(recovery()),
                        min: Some(ValueSource::Literal {
                            value: LiteralValue::Present(json!(1).into()),
                        }),
                        max: None,
                    }
                } else {
                    recovery()
                },
                vec![Value::Number(1.0)],
                Environment::new(mc, None, vec![]),
                RecoveryContext::new(mc).enable(),
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
            let result = execution.result().unwrap();
            assert_eq!(result.end, 1);
            assert!(result.recovered);
            if repeated {
                assert_eq!(result.kind, MatchKind::Ok);
                let Value::Array(values) = result.value.raw() else {
                    panic!("expected collected array")
                };
                assert!(values.borrow().is_empty());
                assert_eq!(result.children[0].kind, MatchKind::Skip);
                assert!(result.children[0].recovered);
            } else {
                assert_eq!(result.kind, MatchKind::Skip);
                assert!(matches!(result.value.raw(), Value::Undefined));
            }
        });
    }
}

#[test]
// req:into-001 req:expressions-runtime-007 req:runtime-memory-005
fn into_drains_an_object_with_a_symbol_iterator_protocol() {
    let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
        let source = Value::object(mc, vec![]);
        let Value::Object(properties) = source else {
            unreachable!()
        };
        properties.borrow_mut(mc).set_symbol(
            "asyncIterator".into(),
            Value::Native(crate::globals::NativeGlobal::Enumerate),
        );
        PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Quantifier {
                    pattern: Box::new(Pattern::Any),
                    min: None,
                    max: None,
                }),
            },
            vec![source],
            Environment::new(mc, None, vec![]),
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
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
    });
}

#[test]
// req:error-recovery-001 req:error-recovery-006
fn resolve_wrappers_preserve_recovery_and_seeded_failure_state() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let recovery = RecoveryContext::new(mc).enable();
        let mut recovered = PatternExecution::new_with_recovery(
            mc,
            Pattern::Recover {
                pattern: Box::new(literal(json!(2))),
                skip: Box::new(Pattern::Any),
            },
            vec![Value::Number(1.0)],
            environment,
            recovery,
        );
        finish(mc, &mut recovered);
        let recovered = recovered.result().unwrap();
        assert!(recovered.recovered);

        let resolve = || Pattern::Resolve {
            target_kind: ResolveTargetKind::Reference,
            name: Some("Nested".into()),
            args: vec![],
            value: None,
        };
        let mut execution = PatternExecution::new(mc, resolve(), vec![], environment);
        assert!(!execution.step(mc).unwrap());
        execution
            .resume_resolve(mc, recovered)
            .expect("recovered match should resume");
        finish(mc, &mut execution);
        assert!(execution.result().unwrap().recovered);

        let mut execution = PatternExecution::new(mc, resolve(), vec![], environment);
        assert!(!execution.step(mc).unwrap());
        let request = execution.take_request().unwrap();
        execution
            .resume_resolve(mc, PatternMatch::seed_failure(mc, &request))
            .expect("seed failure should resume");
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert!(result.seeded);
    });
}

#[test]
// req:equal-001 req:equal-002 req:equal-003 req:equal-004 req:any-001 req:end-001
fn terminals_consume_one_item_only_on_success_and_end_is_zero_width() {
    assert_eq!(run(literal(json!(42)), vec![42.0]), (MatchKind::Ok, 1));
    assert_eq!(run(literal(json!(41)), vec![42.0]), (MatchKind::Fail, 0));
    assert_eq!(run(literal(json!("42")), vec![42.0]), (MatchKind::Fail, 0));
    assert_eq!(run(Pattern::Any, vec![]), (MatchKind::Fail, 0));
    assert_eq!(run(Pattern::End, vec![]), (MatchKind::Ok, 0));
    assert_eq!(run(Pattern::End, vec![42.0]), (MatchKind::Fail, 0));
}

#[test]
// req:equal-001 req:equal-003
fn missing_literal_payload_is_undefined_and_null_remains_distinct() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        for (source, input, expected) in [
            (
                json!({"kind": "value.literal"}),
                Value::Undefined,
                MatchKind::Ok,
            ),
            (
                json!({"kind": "value.literal"}),
                Value::Null,
                MatchKind::Fail,
            ),
            (
                json!({"kind": "value.literal", "value": null}),
                Value::Undefined,
                MatchKind::Fail,
            ),
            (
                json!({"kind": "value.literal", "value": null}),
                Value::Null,
                MatchKind::Ok,
            ),
        ] {
            let pattern: Pattern =
                serde_json::from_value(json!({"kind": "equal", "value": source})).unwrap();
            let mut execution = PatternExecution::new(mc, pattern, vec![input], environment);
            finish(mc, &mut execution);
            assert_eq!(execution.result().unwrap().kind, expected);
        }
    });
}

#[test]
// req:into-001 req:type-001 req:equal-001 req:runtime-memory-005
fn retained_diagnostics_keep_exact_nested_input_and_authored_expectations() {
    #[derive(Collect)]
    #[collect(no_drop)]
    struct Root<'gc> {
        execution: Option<PatternExecution<'gc>>,
        result: Option<Gc<'gc, PatternMatch<'gc>>>,
    }
    let mut arena = Arena::<Rootable![Root<'_>]>::new(|mc| Root {
        execution: Some(PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Then {
                    patterns: vec![
                        literal(json!("x")),
                        Pattern::Type {
                            expected: RuntimeType::Number,
                        },
                    ],
                }),
            },
            vec![Value::string(mc, "xy")],
            Environment::new(mc, None, vec![]),
        )),
        result: None,
    });
    loop {
        let done = arena.mutate_root(|mc, root| root.execution.as_mut().unwrap().step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    arena.mutate_root(|_, root| {
        root.result = root.execution.take().unwrap().result();
    });
    arena.finish_cycle();
    arena.mutate(|mc, root| {
        let outer = root.result.unwrap();
        assert!(outer.current().unwrap().strict_eq(Value::string(mc, "xy")));
        let sequence = outer.children[0];
        let equal = sequence.children[0];
        let failed = sequence.children[1];
        assert!(failed.current().unwrap().strict_eq(Value::string(mc, "y")));
        assert!(failed.current_origin().is_some());
        assert_eq!(failed.expectation().as_deref(), Some("type number"));
        assert_eq!(equal.descriptor(), "equal \"x\"");
        assert_eq!(equal.expectation().as_deref(), Some("equal \"x\""));
        let boundary = PatternMatch::boundary(
            mc,
            PatternKind::Resolve,
            failed,
            failed.environment,
            failed.value,
        );
        assert!(
            boundary
                .current()
                .unwrap()
                .strict_eq(Value::string(mc, "y"))
        );
        assert_eq!(boundary.descriptor(), failed.descriptor());
        assert_eq!(
            PatternMatch::with_seeded(mc, failed, true).descriptor(),
            failed.descriptor()
        );
    });
}

#[test]
// req:error-recovery-001 req:error-recovery-006 req:end-001
fn diagnostic_recovery_provenance_distinguishes_synthetic_wrappers_and_eof() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let mut execution = PatternExecution::new_with_recovery(
            mc,
            Pattern::Recover {
                pattern: Box::new(literal(json!(2))),
                skip: Box::new(Pattern::Any),
            },
            vec![Value::Number(1.0)],
            environment,
            RecoveryContext::new(mc).enable(),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert!(result.is_recovery_node());
        assert!(PatternMatch::with_seeded(mc, result, false).is_recovery_node());
        assert!(
            !PatternMatch::boundary(mc, PatternKind::Recover, result, environment, result.value)
                .is_recovery_node()
        );
        assert!(!PatternMatch::growth_result(mc, result, result, environment).is_recovery_node());
        let mut end = PatternExecution::new(mc, Pattern::End, vec![], environment);
        finish(mc, &mut end);
        let end = end.result().unwrap();
        assert!(end.current().is_none());
        assert_eq!(end.current_origin(), Some(Origin { start: 0, end: 0 }));
        assert_eq!(end.expectation().as_deref(), Some("end"));
    });
}

#[test]
// req:indirect-left-recursion-003 req:error-recovery-006
fn growth_rejects_every_successful_final_attempt_and_seed_flag_can_be_replayed() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let mut seed_execution =
            PatternExecution::new(mc, Pattern::Any, vec![Value::Number(1.0)], environment);
        finish(mc, &mut seed_execution);
        let seed = seed_execution.result().unwrap();
        let mut rejected_execution =
            PatternExecution::new(mc, Pattern::Ok, vec![Value::Number(1.0)], environment);
        finish(mc, &mut rejected_execution);
        let rejected = rejected_execution.result().unwrap();

        let replayed = PatternMatch::with_seeded(mc, rejected, true);
        assert!(replayed.seeded);
        assert_eq!(replayed.kind, MatchKind::Ok);

        let grown = PatternMatch::growth_result(mc, seed, rejected, environment);
        assert_eq!(grown.kind, MatchKind::Ok);
        assert_eq!(grown.children.len(), 2);
        assert_eq!(grown.children[1].kind, MatchKind::Fail);
        assert_eq!(grown.children[1].children[0].kind, MatchKind::Ok);
        assert!(!grown.children[1].recovered);
    });
}

#[test]
// req:between-001 req:equal-006 req:runtime-memory-005
fn between_checks_bounds_before_input_and_preserves_errors_and_provenance() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![("minimum".into(), Value::Number(40.0))]);
        let carried = Value::Number(42.0).wrap(mc, Origin { start: 10, end: 11 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Between {
                left: Some(ValueSource::Variable {
                    name: "minimum".into(),
                }),
                right: Some(ValueSource::Literal {
                    value: LiteralValue::Present(json!(42).into()),
                }),
            },
            vec![carried],
            environment,
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.same_wrapper(carried));
        for value in [Value::Null, Value::Undefined] {
            let mut execution = PatternExecution::new(
                mc,
                Pattern::Between {
                    left: Some(ValueSource::Literal {
                        value: LiteralValue::Present(json!(0).into()),
                    }),
                    right: None,
                },
                vec![value],
                environment,
            );
            assert_eq!(execution.step(mc).unwrap_err(), PatternError::NullValue);
            assert_eq!(execution.step(mc).unwrap_err(), PatternError::NullValue);
        }
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Between {
                left: None,
                right: None,
            },
            vec![],
            environment,
        );
        assert!(matches!(
            execution.step(mc),
            Err(PatternError::InvalidBound(_))
        ));
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Between {
                left: Some(ValueSource::Variable {
                    name: "minimum".into(),
                }),
                right: Some(ValueSource::Variable {
                    name: "missing".into(),
                }),
            },
            vec![],
            environment,
        );
        assert_eq!(
            execution.step(mc).unwrap_err(),
            PatternError::UnknownValueReference("missing".into())
        );
    });
}

#[test]
// req:between-001
fn between_nan_and_incomparable_values_fail_without_consumption() {
    let pattern = || Pattern::Between {
        left: Some(ValueSource::Literal {
            value: LiteralValue::Present(json!(0).into()),
        }),
        right: None,
    };
    assert_eq!(run(pattern(), vec![f64::NAN]), (MatchKind::Fail, 0));
    assert_eq!(
        run(pattern(), vec![f64::NEG_INFINITY]),
        (MatchKind::Fail, 0)
    );
    assert_eq!(run(pattern(), vec![f64::INFINITY]), (MatchKind::Ok, 1));
    gc_arena::arena::rootless_mutate(|mc| {
        for value in [
            Value::Boolean(true),
            Value::array(mc, vec![]),
            Value::object(mc, vec![]),
        ] {
            let mut execution = PatternExecution::new(
                mc,
                pattern(),
                vec![value],
                Environment::new(mc, None, vec![]),
            );
            finish(mc, &mut execution);
            assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
            assert_eq!(execution.result().unwrap().end, 0);
        }
    });
}

#[test]
// req:and-001
fn conjunctions_reuse_position_forward_final_outcome_and_rollback_failures() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern = Pattern::And {
            patterns: vec![
                Pattern::Variable {
                    name: "captured".into(),
                    pattern: Box::new(Pattern::Any),
                },
                Pattern::Equal {
                    value: ValueSource::Variable {
                        name: "captured".into(),
                    },
                },
            ],
        };
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::Number(42.0)], environment);
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.start, 0);
        assert_eq!(result.end, 1);
        assert_eq!(result.children.len(), 2);
        assert_eq!(result.children[0].start, 0);
        assert_eq!(result.children[1].start, 0);
        assert!(
            result
                .environment
                .get("captured")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
        assert!(result.value.strict_eq(Value::Number(42.0)));

        let pattern = Pattern::And {
            patterns: vec![
                Pattern::Variable {
                    name: "captured".into(),
                    pattern: Box::new(Pattern::Any),
                },
                literal(json!(7)),
            ],
        };
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::Number(42.0)], environment);
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
        assert!(result.environment.get("captured").is_none());

        let pattern = Pattern::And {
            patterns: vec![
                Pattern::Skip {
                    pattern: Box::new(Pattern::Any),
                },
                Pattern::Skip {
                    pattern: Box::new(Pattern::Any),
                },
            ],
        };
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::Number(42.0)], environment);
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Skip);
        assert_eq!(result.end, 1);
        assert!(matches!(result.value.raw(), Value::Undefined));

        let mut execution = PatternExecution::new(
            mc,
            Pattern::And { patterns: vec![] },
            vec![Value::Number(42.0)],
            environment,
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 0);
        assert!(matches!(result.value.raw(), Value::Undefined));
    });
}

#[test]
// req:cli-match-001
fn rightmost_failure_reports_furthest_node_without_changing_rollback() {
    gc_arena::arena::rootless_mutate(|mc| {
        let pattern = Pattern::Then {
            patterns: vec![Pattern::Any, literal(json!(99))],
        };
        let mut execution = PatternExecution::new(
            mc,
            pattern,
            vec![Value::Number(1.0), Value::Number(2.0)],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
        assert_eq!(
            execution.rightmost_failure(),
            Some(FailureDiagnostic {
                kind: PatternKind::Equal,
                position: 1,
            })
        );
    });
}

#[test]
// req:over-001 req:over-002 req:runtime-memory-005
fn over_matches_object_fields_and_rest_captures_in_entry_order() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "over",
            "keys": {
                "known": { "kind": "type", "type": "number" }
            },
            "rest": [{
                "kind": "pattern",
                "entry": "entries",
                "key": { "kind": "any" },
                "value": {
                    "kind": "variable",
                    "name": "values",
                    "pattern": { "kind": "any" }
                }
            }]
        }))
        .unwrap();
        let source = Value::object(
            mc,
            vec![
                ("known".into(), Value::Number(1.0)),
                ("first".into(), Value::Number(2.0)),
                ("second".into(), Value::Number(3.0)),
            ],
        );
        let mut execution = PatternExecution::new(mc, pattern, vec![source], environment);
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(result.children.len(), 5);
        let Value::Array(values) = result.environment.get("values").unwrap().raw() else {
            panic!("expected rest value capture array");
        };
        assert_eq!(values.borrow().len(), 2);
        assert!(values.borrow()[0].strict_eq(Value::Number(2.0)));
        assert!(values.borrow()[1].strict_eq(Value::Number(3.0)));
        let Value::Array(entries) = result.environment.get("entries").unwrap().raw() else {
            panic!("expected rest entry capture array");
        };
        assert_eq!(entries.borrow().len(), 2);
        for (entry, expected_key, expected_value) in [
            (entries.borrow()[0], "first", 2.0),
            (entries.borrow()[1], "second", 3.0),
        ] {
            let Value::Array(pair) = entry.raw() else {
                panic!("expected captured [key, value] pair");
            };
            assert!(pair.borrow()[0].strict_eq(Value::string(mc, expected_key)));
            assert!(pair.borrow()[1].strict_eq(Value::Number(expected_value)));
        }

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "over",
            "keys": { "k": { "kind": "equal", "value": { "kind": "value.literal", "value": 7 } } }
        }))
        .unwrap();
        let mut execution = PatternExecution::new(
            mc,
            pattern,
            vec![Value::map(
                mc,
                vec![(Value::string(mc, "k"), Value::Number(7.0))],
            )],
            environment,
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
    });
}

#[test]
// req:switch-001 req:switch-002 req:switch-003
fn switch_commits_to_first_matching_key_and_uses_default_only_without_a_match() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "switch",
            "cases": [
                {
                    "key": { "kind": "values", "values": [
                        { "kind": "value.literal", "value": "a" }
                    ]},
                    "pattern": { "kind": "equal", "value": { "kind": "value.literal", "value": "z" } }
                },
                {
                    "key": { "kind": "values", "values": [
                        { "kind": "value.literal", "value": "a" }
                    ]},
                    "pattern": { "kind": "any" }
                }
            ],
            "default": { "kind": "any" }
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "a")], environment);
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
        assert_eq!(result.children.len(), 1);

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "switch",
            "cases": [{
                "key": { "kind": "values", "values": [
                    { "kind": "value.literal", "value": "a" }
                ]},
                "pattern": { "kind": "fail" }
            }],
            "default": { "kind": "any" }
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "b")], environment);
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "switch",
            "cases": []
        }))
        .unwrap();
        let mut execution = PatternExecution::new(mc, pattern, vec![], environment);
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
    });
}

#[test]
// req:character-001
fn character_matches_unicode_category_and_reports_invalid_input() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "character",
            "characterClass": "L"
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "é")], environment);
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "character",
            "characterClass": "not-a-class"
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "x")], environment);
        assert!(matches!(
            execution.step(mc),
            Err(PatternError::InvalidArgument(_))
        ));

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "character",
            "characterClass": "L"
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::Number(42.0)], environment);
        assert!(matches!(
            execution.step(mc),
            Err(PatternError::TypeError(_))
        ));
    });
}

#[test]
// req:regexp-001
fn regexp_uses_ecmascript_pattern_syntax_on_a_string_item() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "regexp",
            "pattern": { "source": "^\\d+$", "flags": "" }
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "42")], environment);
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);

        let pattern: Pattern = serde_json::from_value(json!({
            "kind": "regexp",
            "pattern": { "source": "^\\d+$", "flags": "" }
        }))
        .unwrap();
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::string(mc, "4a")], environment);
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
        assert_eq!(execution.result().unwrap().end, 0);
    });
}

#[test]
// req:then-001 req:or-001 req:composition-001 req:variable-001 req:runtime-memory-005
fn failed_choice_restores_position_and_binding_scope() {
    let pattern = Pattern::Or {
        patterns: vec![
            Pattern::Then {
                patterns: vec![
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                    Pattern::Fail,
                ],
            },
            Pattern::Variable {
                name: "x".into(),
                pattern: Box::new(literal(json!(42))),
            },
        ],
    };
    assert_eq!(run(pattern, vec![42.0]), (MatchKind::Ok, 1));
}

#[test]
// req:maybe-001 req:not-001 req:lookahead-001 req:skip-001 req:skip-002
fn unary_patterns_preserve_consumption_and_skip_propagation() {
    assert_eq!(
        run(
            Pattern::Maybe {
                pattern: Box::new(Pattern::Fail)
            },
            vec![1.0]
        ),
        (MatchKind::Ok, 0)
    );
    assert_eq!(
        run(
            Pattern::Not {
                pattern: Box::new(Pattern::Any)
            },
            vec![1.0]
        ),
        (MatchKind::Fail, 0)
    );
    assert_eq!(
        run(
            Pattern::Not {
                pattern: Box::new(Pattern::Fail)
            },
            vec![1.0]
        ),
        (MatchKind::Ok, 0)
    );
    assert_eq!(
        run(
            Pattern::Lookahead {
                pattern: Box::new(Pattern::Any)
            },
            vec![1.0]
        ),
        (MatchKind::Ok, 0)
    );
    assert_eq!(
        run(
            Pattern::Skip {
                pattern: Box::new(Pattern::Any)
            },
            vec![1.0]
        ),
        (MatchKind::Skip, 1)
    );
}

#[test]
// req:into-001 req:runtime-memory-005
fn into_requires_entire_nested_unicode_stream_and_consumes_one_outer_item() {
    for (pattern, expected) in [
        (Pattern::Any, MatchKind::Fail),
        (
            Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any, Pattern::End],
            },
            MatchKind::Ok,
        ),
    ] {
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            PatternExecution::new(
                mc,
                Pattern::Into {
                    pattern: Box::new(pattern),
                },
                vec![Value::string(mc, "😀a")],
                Environment::new(mc, None, vec![]),
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
            let result = execution.result().unwrap();
            assert_eq!(result.kind, expected);
            assert_eq!(result.end, usize::from(expected == MatchKind::Ok));
            assert_eq!(
                result.children[0].end,
                if expected == MatchKind::Ok { 2 } else { 1 }
            );
        });
    }
}

#[test]
// req:equal-006 req:variable-001 req:into-001
fn contextual_sources_and_pattern_errors_are_explicit() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![("x".into(), Value::Undefined)]);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: ValueSource::Variable { name: "x".into() },
            },
            vec![Value::Undefined],
            environment,
        );
        assert!(execution.step(mc).unwrap());
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: ValueSource::Variable {
                    name: "missing".into(),
                },
            },
            vec![],
            environment,
        );
        assert_eq!(
            execution.step(mc).unwrap_err(),
            PatternError::UnknownValueReference("missing".into())
        );
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Variable {
                name: "x".into(),
                pattern: Box::new(Pattern::Any),
            },
            vec![Value::Number(1.0)],
            environment,
        );
        assert_eq!(
            execution.step(mc).unwrap_err(),
            PatternError::DuplicateVariable("x".into())
        );
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Any),
            },
            vec![Value::Number(1.0)],
            environment,
        );
        assert_eq!(
            execution.step(mc).unwrap_err(),
            PatternError::IterableExpected
        );
    });
}

#[test]
// req:runtime-memory-005 req:maybe-001
fn deep_patterns_execute_and_drop_without_host_recursion() {
    let mut pattern = Pattern::Any;
    for _ in 0..20_000 {
        pattern = Pattern::Maybe {
            pattern: Box::new(pattern),
        };
    }
    // Full collection on each of 40,001 steps would be quadratic in live
    // match-tree size; stress collection at bounded intervals instead.
    let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
        PatternExecution::new(
            mc,
            pattern,
            vec![Value::Number(42.0)],
            Environment::new(mc, None, vec![]),
        )
    });
    let mut steps = 0;
    loop {
        let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
        steps += 1;
        arena.collect_debt();
        if steps % 1000 == 0 {
            arena.finish_cycle();
        }
        if done {
            break;
        }
    }
    arena.finish_cycle();
    arena.mutate(|_, execution| {
        assert_eq!(execution.result().unwrap().end, 1);
    });
}

#[test]
// req:expressions-runtime-007 req:equal-006
fn unsupported_pattern_shapes_and_bare_value_sources_fail_decoding() {
    for source in [
        r#"{"kind":"unknown"}"#,
        r#"{"kind":"equal","value":42}"#,
        r#"{"kind":"variable","name":"x"}"#,
        r#"{"kind":"resolve","name":"unknown"}"#,
    ] {
        assert!(serde_json::from_str::<Pattern>(source).is_err(), "{source}");
    }
}

fn fixture_value<'gc>(mc: &Mutation<'gc>, value: &serde_json::Value) -> Value<'gc> {
    match value {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(value) => Value::Boolean(*value),
        serde_json::Value::Number(value) => Value::Number(value.as_f64().unwrap()),
        serde_json::Value::String(value) => Value::string(mc, value),
        serde_json::Value::Array(values) => Value::array(
            mc,
            values
                .iter()
                .map(|value| fixture_value(mc, value))
                .collect(),
        ),
        serde_json::Value::Object(values) => Value::object(
            mc,
            values
                .iter()
                .map(|(key, value)| (key.clone().into(), fixture_value(mc, value)))
                .collect(),
        ),
    }
}

fn assert_fixture_value(value: Value<'_>, expected: &serde_json::Value) {
    match (value.raw(), expected) {
        (Value::Null, serde_json::Value::Null) => {}
        (Value::Number(actual), serde_json::Value::Number(expected)) => {
            assert_eq!(Some(actual), expected.as_f64())
        }
        (Value::String(actual), serde_json::Value::String(expected)) => {
            assert_eq!(*actual, *expected)
        }
        (Value::Boolean(actual), serde_json::Value::Bool(expected)) => {
            assert_eq!(actual, *expected)
        }
        (Value::Array(actual), serde_json::Value::Array(expected)) => {
            assert_eq!(actual.borrow().len(), expected.len());
            for (actual, expected) in actual.borrow().iter().zip(expected) {
                assert_fixture_value(*actual, expected);
            }
        }
        (Value::Object(actual), serde_json::Value::Object(expected)) => {
            assert_eq!(actual.borrow().entries().len(), expected.len());
            for (key, value) in actual.borrow().entries() {
                assert_fixture_value(
                    *value,
                    expected
                        .get(key.as_scalar_str().expect("scalar fixture key"))
                        .unwrap_or_else(|| panic!("unexpected object key {key:?}")),
                );
            }
        }
        _ => panic!("fixture value mismatch; non-JSON values must not be flattened to JSON"),
    }
}

#[test]
// req:any-001 req:equal-002 req:equal-006 req:includes-001 req:then-001 req:or-001
// req:composition-001 req:variable-001 req:lookahead-001 req:skip-002 req:into-001
// req:except-001 req:type-001 req:quantifier-001 req:runtime-memory-005
fn shared_pattern_fixtures_match_typescript_with_gc_between_every_frame() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../test/rust/pattern-fixtures.json")).unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let pattern: Pattern = serde_json::from_value(fixture["ast"].clone()).unwrap();
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            let input = fixture["input"]
                .as_array()
                .unwrap()
                .iter()
                .map(|value| fixture_value(mc, value))
                .collect();
            PatternExecution::new(mc, pattern, input, Environment::new(mc, None, vec![]))
        });
        loop {
            let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
            arena.finish_cycle();
            if done {
                break;
            }
        }
        arena.mutate(|_, execution| {
            let result = execution.result().unwrap();
            assert_eq!(
                result.kind,
                match fixture["kind"].as_str().unwrap() {
                    "ok" => MatchKind::Ok,
                    "fail" => MatchKind::Fail,
                    _ => panic!("unsupported fixture outcome"),
                },
                "{}",
                fixture["name"]
            );
            assert_eq!(
                Some(result.end as u64),
                fixture["end"].as_u64(),
                "{}",
                fixture["name"]
            );
            if result.kind == MatchKind::Ok {
                assert_fixture_value(result.value, &fixture["expected"]);
            }
        });
    }
}

#[test]
// req:character-001 req:over-001 req:switch-001 req:runtime-memory-005
fn shared_extra_pattern_fixtures_match_typescript_with_gc_between_every_frame() {
    let fixtures: serde_json::Value = serde_json::from_str(include_str!(
        "../../../test/rust/pattern-extra-fixtures.json"
    ))
    .unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let pattern: Pattern = serde_json::from_value(fixture["ast"].clone()).unwrap();
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            let input = fixture["input"]
                .as_array()
                .unwrap()
                .iter()
                .map(|value| fixture_value(mc, value))
                .collect();
            PatternExecution::new(mc, pattern, input, Environment::new(mc, None, vec![]))
        });
        loop {
            let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
            arena.finish_cycle();
            if done {
                break;
            }
        }
        arena.mutate(|_, execution| {
            let result = execution.result().unwrap();
            assert_eq!(
                result.kind,
                match fixture["kind"].as_str().unwrap() {
                    "ok" => MatchKind::Ok,
                    "fail" => MatchKind::Fail,
                    _ => panic!("unsupported fixture outcome"),
                },
                "{}",
                fixture["name"]
            );
            assert_eq!(
                Some(result.end as u64),
                fixture["end"].as_u64(),
                "{}",
                fixture["name"]
            );
            if result.kind == MatchKind::Ok {
                assert_fixture_value(result.value, &fixture["expected"]);
            }
        });
    }
}

#[test]
// req:includes-001 req:equal-002 req:equal-006
fn includes_uses_same_value_zero_and_resolves_all_operands_before_comparing() {
    gc_arena::arena::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![("nan".into(), Value::Number(f64::NAN))]);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Includes {
                values: vec![ValueSource::Variable { name: "nan".into() }],
            },
            vec![Value::Number(f64::NAN)],
            environment,
        );
        assert!(execution.step(mc).unwrap());
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Includes {
                values: vec![
                    ValueSource::Literal {
                        value: LiteralValue::Present(json!(42).into()),
                    },
                    ValueSource::Variable {
                        name: "missing".into(),
                    },
                ],
            },
            vec![Value::Number(42.0)],
            environment,
        );
        let expected = PatternError::UnknownValueReference("missing".into());
        assert_eq!(execution.step(mc).unwrap_err(), expected);
        assert_eq!(execution.step(mc).unwrap_err(), expected);
        assert!(execution.result().is_none());
    });
}

#[test]
// req:quantifier-001
fn zero_maximum_does_not_run_child_even_when_input_is_available() {
    // This is the normative max-bound contract, not the current TypeScript
    // implementation's first-attempt-before-max-check behavior.
    let pattern = Pattern::Quantifier {
        pattern: Box::new(Pattern::Equal {
            value: ValueSource::Variable {
                name: "missing".into(),
            },
        }),
        min: None,
        max: Some(ValueSource::Literal {
            value: LiteralValue::Present(json!(0).into()),
        }),
    };
    assert_eq!(run(pattern, vec![42.0]), (MatchKind::Ok, 0));
}

#[test]
// req:quantifier-001 req:runtime-memory-005
fn open_repetition_records_end_attempt_and_closed_input_does_not() {
    for open in [false, true] {
        let mut arena = Arena::<Rootable![PatternExecution<'_>]>::new(|mc| {
            let pattern = Pattern::Quantifier {
                pattern: Box::new(Pattern::Any),
                min: None,
                max: None,
            };
            let environment = Environment::new(mc, None, vec![]);
            if open {
                PatternExecution::new_open(mc, pattern, vec![Value::Number(42.0)], environment)
            } else {
                PatternExecution::new(mc, pattern, vec![Value::Number(42.0)], environment)
            }
        });
        loop {
            let done = arena.mutate_root(|mc, execution| execution.step(mc).unwrap());
            arena.finish_cycle();
            if done {
                break;
            }
        }
        arena.mutate(|_, execution| {
            let result = execution.result().unwrap();
            assert_eq!(result.end, 1);
            assert_eq!(result.children.len(), if open { 2 } else { 1 });
            if open {
                assert_eq!(result.children[1].kind, MatchKind::Fail);
            }
        });
    }
}

#[test]
// req:quantifier-001
fn invalid_bounds_fail_before_any_child_evaluation() {
    gc_arena::arena::rootless_mutate(|mc| {
        for value in [json!(-1), json!(1.5), json!("1"), json!(null)] {
            let mut execution = PatternExecution::new(
                mc,
                Pattern::Quantifier {
                    pattern: Box::new(Pattern::Any),
                    min: Some(ValueSource::Literal {
                        value: LiteralValue::Present(value.into()),
                    }),
                    max: None,
                },
                vec![],
                Environment::new(mc, None, vec![]),
            );
            assert!(matches!(
                execution.step(mc),
                Err(PatternError::InvalidBound(_))
            ));
            assert!(execution.result().is_none());
        }
    });
}

#[test]
// req:into-001 req:runtime-memory-002 req:runtime-memory-003 req:runtime-memory-005
fn retained_values_preserve_source_characters_without_retaining_match_trees() {
    #[derive(Collect)]
    #[collect(no_drop)]
    struct Roots<'gc> {
        execution: Option<PatternExecution<'gc>>,
        value: Value<'gc>,
    }
    let mut arena = Arena::<Rootable![Roots<'_>]>::new(|mc| {
        let input = Value::string(mc, "😀a").wrap_root(mc);
        let pattern = Pattern::Into {
            pattern: Box::new(Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any],
            }),
        };
        Roots {
            execution: Some(PatternExecution::new(
                mc,
                pattern,
                vec![input],
                Environment::new(mc, None, vec![]),
            )),
            value: Value::Undefined,
        }
    });
    loop {
        let done =
            arena.mutate_root(|mc, roots| roots.execution.as_mut().unwrap().step(mc).unwrap());
        arena.finish_cycle();
        if done {
            break;
        }
    }
    let retained = arena.metrics().total_gc_count();
    arena.mutate_root(|_, roots| {
        roots.value = roots.execution.as_ref().unwrap().result().unwrap().value;
        roots.execution = None;
    });
    arena.finish_cycle();
    assert!(arena.metrics().total_gc_count() < retained);
    arena.mutate(|_, roots| {
        let Value::Array(items) = roots.value.raw() else {
            panic!("array")
        };
        assert_eq!(
            items.borrow()[0].origin(),
            Some(Origin { start: 0, end: 1 })
        );
        assert_eq!(
            items.borrow()[1].origin(),
            Some(Origin { start: 1, end: 2 })
        );
        assert_eq!(roots.value.origin(), Some(Origin { start: 0, end: 2 }));
    });
}

#[test]
// req:runtime-memory-005 req:equal-002
fn deeply_nested_literal_sources_are_dropped_without_host_recursion() {
    let mut value = json!(42);
    for _ in 0..20_000 {
        value = serde_json::Value::Array(vec![value]);
    }
    assert_eq!(run(literal(value), vec![42.0]), (MatchKind::Fail, 0));
}

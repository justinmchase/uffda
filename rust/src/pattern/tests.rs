use super::*;
use gc_arena::{Arena, Rootable};
use serde_json::json;

fn literal(value: serde_json::Value) -> Pattern {
    Pattern::Equal {
        value: ValueSource::Literal { value },
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
                .map(|(key, value)| (key.clone(), fixture_value(mc, value)))
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
                    ValueSource::Literal { value: json!(42) },
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
        max: Some(ValueSource::Literal { value: json!(0) }),
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
                    min: Some(ValueSource::Literal { value }),
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

use super::*;
use crate::expression::ArrayInitializer;
use serde_json::json;

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
                .map(|(name, value)| (name.clone(), snapshot(*value)))
                .collect(),
        ),
        Value::Undefined => panic!("undefined must be checked directly, not flattened into JSON"),
        Value::Lambda(_) => panic!("callables must be checked directly, not flattened into JSON"),
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
        EvaluationError::StringCoercion(crate::coercion::StringCoercionError::CannotConvertObject)
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
            value: json!({"nested":[1,2,3]}),
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

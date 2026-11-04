#![allow(unused_imports)]
use super::*;
use serde_json::json;

#[allow(dead_code)]
fn literal(value: serde_json::Value) -> Pattern {
    Pattern::Equal {
        value: ValueSource::Literal {
            value: LiteralValue::Present(value.into()),
        },
    }
}

#[allow(dead_code)]
fn assert_item(
    pattern: Pattern,
    input: serde_json::Value,
    kind: MatchKind,
    end: usize,
    value: &str,
) {
    let mut runtime =
        crate::runtime::Runtime::for_pattern(pattern, input, crate::runtime::InputMode::Iterable)
            .unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, kind);
        assert_eq!(result.end, end);
        if kind != MatchKind::Fail {
            assert_eq!(item_text(result.value), value);
        }
    });
}

#[allow(dead_code)]
fn item_text(value: Value<'_>) -> String {
    match value.raw() {
        Value::Undefined => "undefined".into(),
        Value::Number(number) => number.to_string(),
        Value::Boolean(value) => value.to_string(),
        Value::String(text) => text.to_utf8().unwrap(),
        Value::Array(items) => items
            .borrow()
            .iter()
            .map(|item| item_text(*item))
            .collect::<Vec<_>>()
            .join("|"),
        other => panic!("unexpected match value {:?}", other.runtime_type()),
    }
}

fn finish<'gc>(mc: &uffda_heap::Mutation<'gc>, execution: &mut PatternExecution<'gc>) {
    while !execution.step(mc).unwrap() {}
}

fn drive<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    execution: &mut PatternExecution<'gc>,
) -> Result<(), PatternError> {
    loop {
        if execution.step(mc)? {
            return Ok(());
        }
    }
}

fn add_refs(left: &str, right: &str) -> crate::expression::Expression {
    crate::expression::Expression::Invocation {
        expression: Box::new(crate::expression::Expression::Reference { name: "add".into() }),
        args: vec![
            crate::expression::InvocationArgument::Expression(
                crate::expression::Expression::Reference { name: left.into() },
            ),
            crate::expression::InvocationArgument::Expression(
                crate::expression::Expression::Reference { name: right.into() },
            ),
        ],
    }
}

fn add_literal(name: &str, right: f64) -> crate::expression::Expression {
    crate::expression::Expression::Invocation {
        expression: Box::new(crate::expression::Expression::Reference { name: "add".into() }),
        args: vec![
            crate::expression::InvocationArgument::Expression(
                crate::expression::Expression::Reference { name: name.into() },
            ),
            crate::expression::InvocationArgument::Expression(
                crate::expression::Expression::Number { value: right },
            ),
        ],
    }
}

#[test]
// req:variable-001
fn port_variable_binds_one_value_for_a_projection() {
    // VARIABLE00: x:any -> x + 11 over [7] yields 18.
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Variable {
                name: "x".into(),
                pattern: Box::new(Pattern::Any),
            }),
            expression: Box::new(add_literal("x", 11.0)),
        },
        json!([7]),
        MatchKind::Ok,
        1,
        "18",
    );
}

#[test]
// req:variable-001
fn port_variable_binds_sequential_values_for_a_projection() {
    // VARIABLE01: x:any y:any -> x + y over [7, 11] yields 18.
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Then {
                patterns: vec![
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                    Pattern::Variable {
                        name: "y".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                ],
            }),
            expression: Box::new(add_refs("x", "y")),
        },
        json!([7, 11]),
        MatchKind::Ok,
        2,
        "18",
    );
}

#[test]
// req:variable-001 req:over-001
fn port_variable_binds_object_fields_for_a_projection() {
    // VARIABLE02: { X: x:any, Y: y:any } -> x + y over [{X:7, Y:11}].
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Over {
                keys: Some(vec![
                    (
                        "X".into(),
                        Pattern::Variable {
                            name: "x".into(),
                            pattern: Box::new(Pattern::Any),
                        },
                    ),
                    (
                        "Y".into(),
                        Pattern::Variable {
                            name: "y".into(),
                            pattern: Box::new(Pattern::Any),
                        },
                    ),
                ]),
                rest: None,
            }),
            expression: Box::new(add_refs("x", "y")),
        },
        json!([{ "X": 7, "Y": 11 }]),
        MatchKind::Ok,
        1,
        "18",
    );
}

#[test]
// req:variable-001 req:over-001 req:into-001
fn port_variable_binds_from_nested_object_fields() {
    // VARIABLE03: variables declared inside object property patterns stay in scope.
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Over {
                keys: Some(vec![
                    (
                        "X".into(),
                        Pattern::Into {
                            pattern: Box::new(Pattern::Then {
                                patterns: vec![
                                    Pattern::Any,
                                    Pattern::Variable {
                                        name: "x".into(),
                                        pattern: Box::new(Pattern::Any),
                                    },
                                ],
                            }),
                        },
                    ),
                    (
                        "Y".into(),
                        Pattern::Into {
                            pattern: Box::new(Pattern::Then {
                                patterns: vec![
                                    Pattern::Any,
                                    Pattern::Variable {
                                        name: "y".into(),
                                        pattern: Box::new(Pattern::Any),
                                    },
                                ],
                            }),
                        },
                    ),
                ]),
                rest: None,
            }),
            expression: Box::new(add_refs("x", "y")),
        },
        json!([{ "X": [6, 7], "Y": [10, 11] }]),
        MatchKind::Ok,
        1,
        "18",
    );
}

#[test]
// req:variable-001
fn port_variable_rejects_a_second_binding_of_the_same_name() {
    // VARIABLE05: declaring x twice is an error at the second binding.
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Then {
                patterns: vec![
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                ],
            },
            vec![Value::Number(1.0), Value::Number(2.0)],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err(),
            PatternError::DuplicateVariable("x".into())
        );
        assert_eq!(
            execution.step(mc).unwrap_err().to_string(),
            "Variable x already exists in scope"
        );
    });
}

#[test]
// req:variable-001
fn port_variable_treats_an_undefined_binding_as_already_declared() {
    // VARIABLE06: a binding whose value is undefined is still a binding.
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Then {
                patterns: vec![
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Ok),
                    },
                    Pattern::Variable {
                        name: "x".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                ],
            },
            vec![Value::Number(1.0)],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err(),
            PatternError::DuplicateVariable("x".into())
        );
    });
}

#[test]
// req:variable-001 req:skip-002
fn port_variable_skip_is_a_skipped_success_that_binds_undefined() {
    // VARIABLE_SKIP00 and VARIABLE_SKIP01.
    assert_item(
        Pattern::Variable {
            name: "x".into(),
            pattern: Box::new(Pattern::Skip {
                pattern: Box::new(literal(json!("a"))),
            }),
        },
        json!("a"),
        MatchKind::Skip,
        1,
        "undefined",
    );
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Projection {
                pattern: Box::new(Pattern::Variable {
                    name: "x".into(),
                    pattern: Box::new(Pattern::Skip {
                        pattern: Box::new(literal(json!("a"))),
                    }),
                }),
                expression: Box::new(crate::expression::Expression::Reference { name: "x".into() }),
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(matches!(result.value.raw(), Value::Undefined));
        assert!(matches!(
            result.environment.get("x").unwrap().raw(),
            Value::Undefined
        ));
    });
}

fn literal_bound(value: f64) -> Option<ValueSource> {
    Some(ValueSource::Literal {
        value: LiteralValue::Present(json!(value).into()),
    })
}

fn quantifier(pattern: Pattern, min: Option<f64>, max: Option<f64>) -> Pattern {
    Pattern::Quantifier {
        pattern: Box::new(pattern),
        min: min.and_then(literal_bound),
        max: max.and_then(literal_bound),
    }
}

#[test]
// req:quantifier-001
fn port_quantifier_max_zero_never_evaluates_the_child() {
    for input in [json!([42]), json!([]), json!("abc")] {
        for pattern in [
            Pattern::Any,
            Pattern::Fail,
            Pattern::Equal {
                value: ValueSource::Variable {
                    name: "unbound".into(),
                },
            },
        ] {
            assert_item(
                quantifier(pattern, Some(0.0), Some(0.0)),
                input.clone(),
                MatchKind::Ok,
                0,
                "",
            );
        }
    }
}

#[test]
// req:quantifier-001
fn port_quantifier_repeats_until_bounds_or_the_closed_end() {
    // QUANTIFIER00: a non-progressing `ok` is kept once and does not consume.
    assert_item(
        quantifier(Pattern::Ok, None, None),
        json!("abc"),
        MatchKind::Ok,
        0,
        "undefined",
    );
    // QUANTIFIER01
    assert_item(
        quantifier(Pattern::Any, None, None),
        json!(""),
        MatchKind::Ok,
        0,
        "",
    );
    // QUANTIFIER02
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            None,
            None,
        ),
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
    // QUANTIFIER03
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            None,
            None,
        ),
        json!("abc"),
        MatchKind::Ok,
        3,
        "a|b|c",
    );
    let letter_a = Pattern::Regexp {
        pattern: RegExpSpec::Source("a".into()),
    };
    // QUANTIFIER04
    assert_item(
        Pattern::Then {
            patterns: vec![quantifier(letter_a, None, None), Pattern::Any],
        },
        json!("b"),
        MatchKind::Ok,
        1,
        "|b",
    );
    // QUANTIFIER05. RegExpSpec is not Clone, so the pattern is built again.
    assert_item(
        Pattern::Then {
            patterns: vec![
                Pattern::Any,
                quantifier(
                    Pattern::Regexp {
                        pattern: RegExpSpec::Source("a".into()),
                    },
                    None,
                    None,
                ),
            ],
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "a|",
    );
    // QUANTIFIER06
    assert_item(
        quantifier(Pattern::Any, Some(1.0), None),
        json!(""),
        MatchKind::Fail,
        0,
        "",
    );
    // QUANTIFIER07
    assert_item(
        quantifier(Pattern::Ok, Some(3.0), None),
        json!("a"),
        MatchKind::Ok,
        0,
        "undefined|undefined|undefined",
    );
    // QUANTIFIER08
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            Some(1.0),
            None,
        ),
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
    // QUANTIFIER09
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            Some(3.0),
            None,
        ),
        json!("abc"),
        MatchKind::Ok,
        3,
        "a|b|c",
    );
    // QUANTIFIER10
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            Some(3.0),
            Some(3.0),
        ),
        json!("abc"),
        MatchKind::Ok,
        3,
        "a|b|c",
    );
    // QUANTIFIER11
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            Some(3.0),
            Some(3.0),
        ),
        json!("ab"),
        MatchKind::Fail,
        0,
        "",
    );
    // QUANTIFIER12: stops at max and leaves the rest of the input.
    assert_item(
        quantifier(
            Pattern::Type {
                expected: RuntimeType::String,
            },
            Some(3.0),
            Some(3.0),
        ),
        json!("abcd"),
        MatchKind::Ok,
        3,
        "a|b|c",
    );
}

#[test]
// req:quantifier-001
fn port_quantifier_resolves_variable_bounds() {
    // QUANTIFIER_VALUE_SOURCE_BOUNDS
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Quantifier {
                pattern: Box::new(Pattern::Type {
                    expected: RuntimeType::String,
                }),
                min: Some(ValueSource::Variable { name: "n".into() }),
                max: Some(ValueSource::Variable { name: "n".into() }),
            },
            vec![
                Value::string(mc, "a"),
                Value::string(mc, "b"),
                Value::string(mc, "c"),
                Value::string(mc, "d"),
            ],
            Environment::new(mc, None, vec![("n".into(), Value::Number(2.0))]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 2);
        assert_eq!(item_text(result.value), "a|b");
    });
}

#[test]
// req:quantifier-001
fn port_quantifier_records_one_extra_attempt_only_on_open_input() {
    let kinds = |open: bool| {
        uffda_heap::rootless_mutate(|mc| {
            let pattern = quantifier(
                Pattern::Type {
                    expected: RuntimeType::String,
                },
                None,
                None,
            );
            let input = vec![Value::string(mc, "a"), Value::string(mc, "b")];
            let environment = Environment::new(mc, None, vec![]);
            let mut execution = if open {
                PatternExecution::new_open(mc, pattern, input, environment)
            } else {
                PatternExecution::new(mc, pattern, input, environment)
            };
            finish(mc, &mut execution);
            let result = execution.result().unwrap();
            assert_eq!(result.kind, MatchKind::Ok);
            assert_eq!(item_text(result.value), "a|b");
            result
                .children
                .iter()
                .map(|child| child.kind)
                .collect::<Vec<_>>()
        })
    };
    assert_eq!(
        kinds(true),
        vec![MatchKind::Ok, MatchKind::Ok, MatchKind::Fail]
    );
    assert_eq!(kinds(false), vec![MatchKind::Ok, MatchKind::Ok]);
}

#[test]
// req:quantifier-001 req:skip-002
fn port_quantifier_omits_skipped_repetitions_but_counts_them() {
    // QUANTIFIER_SKIP00
    assert_item(
        quantifier(
            Pattern::Or {
                patterns: vec![
                    Pattern::Type {
                        expected: RuntimeType::String,
                    },
                    Pattern::Skip {
                        pattern: Box::new(Pattern::Any),
                    },
                ],
            },
            None,
            None,
        ),
        json!(["a", 1, "b", 2]),
        MatchKind::Ok,
        4,
        "a|b",
    );
    // QUANTIFIER_SKIP01
    assert_item(
        quantifier(
            Pattern::Skip {
                pattern: Box::new(Pattern::Any),
            },
            Some(2.0),
            None,
        ),
        json!("ab"),
        MatchKind::Ok,
        2,
        "",
    );
    // QUANTIFIER_SKIP02
    assert_item(
        quantifier(
            Pattern::Skip {
                pattern: Box::new(Pattern::Any),
            },
            Some(2.0),
            None,
        ),
        json!("a"),
        MatchKind::Fail,
        0,
        "",
    );
    // QUANTIFIER_SKIP03
    assert_item(
        quantifier(
            Pattern::Skip {
                pattern: Box::new(Pattern::Any),
            },
            None,
            Some(1.0),
        ),
        json!("ab"),
        MatchKind::Ok,
        1,
        "",
    );
}

#[test]
// req:projection-001
fn port_projection_replaces_a_successful_child_with_the_expression() {
    // PROJECTION00
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Any),
            expression: Box::new(crate::expression::Expression::Number { value: 11.0 }),
        },
        json!([7]),
        MatchKind::Ok,
        1,
        "11",
    );
    // PROJECTION01
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Variable {
                name: "x".into(),
                pattern: Box::new(Pattern::Any),
            }),
            expression: Box::new(add_literal("x", 11.0)),
        },
        json!([7]),
        MatchKind::Ok,
        1,
        "18",
    );
}

#[test]
// req:projection-001
fn port_projection_fails_without_evaluating_the_expression() {
    // PROJECTION02. The expression would be an unknown reference if it ran.
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Projection {
                pattern: Box::new(literal(json!("nope"))),
                expression: Box::new(crate::expression::Expression::Reference {
                    name: "missing".into(),
                }),
            },
            vec![Value::string(mc, "yes")],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
    });
}

#[test]
// req:projection-001
fn port_projection_reports_an_expression_error() {
    // PROJECTION03: a throwing expression is a pattern error, not a failure.
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Projection {
                pattern: Box::new(Pattern::Any),
                expression: Box::new(crate::expression::Expression::Reference {
                    name: "missing".into(),
                }),
            },
            vec![Value::Number(7.0)],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err(),
            PatternError::Expression(Box::new(
                crate::evaluate::EvaluationError::UnknownReference("missing".into())
            ))
        );
    });
}

#[test]
// req:projection-001 req:skip-002
fn port_projection_of_a_skip_is_an_ordinary_success() {
    // PROJECTION_SKIP00: `_` is undefined because the child was skipped.
    assert_item(
        Pattern::Projection {
            pattern: Box::new(Pattern::Skip {
                pattern: Box::new(literal(json!("a"))),
            }),
            expression: Box::new(crate::expression::Expression::Reference { name: "_".into() }),
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "undefined",
    );
}

fn string_type() -> Pattern {
    Pattern::Type {
        expected: RuntimeType::String,
    }
}

#[test]
// req:into-001
fn port_into_matches_a_nested_iterable_only_when_it_is_fully_consumed() {
    // INTO00
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Not {
                pattern: Box::new(Pattern::Any),
            }),
        },
        json!([[]]),
        MatchKind::Ok,
        1,
        "undefined",
    );
    // INTO01
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Any),
        },
        json!([["a"]]),
        MatchKind::Ok,
        1,
        "a",
    );
    // INTO02
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any],
            }),
        },
        json!([["a", "b"]]),
        MatchKind::Ok,
        1,
        "a|b",
    );
    // INTO03
    assert_item(
        Pattern::Into {
            pattern: Box::new(quantifier(Pattern::Any, None, None)),
        },
        json!([["a", "b"]]),
        MatchKind::Ok,
        1,
        "a|b",
    );
    // INTO04
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Any),
        },
        json!([["a", "b"]]),
        MatchKind::Fail,
        0,
        "",
    );
    // INTO05
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Into {
                pattern: Box::new(Pattern::Any),
            }),
        },
        json!([[["a"]]]),
        MatchKind::Ok,
        1,
        "a",
    );
    // INTO06
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any],
            }),
        },
        json!([["a"], "b"]),
        MatchKind::Fail,
        0,
        "",
    );
    // INTO07
    assert_item(
        Pattern::And {
            patterns: vec![
                string_type(),
                Pattern::Into {
                    pattern: Box::new(Pattern::Then {
                        patterns: vec![string_type(), string_type(), string_type()],
                    }),
                },
            ],
        },
        json!(["abc"]),
        MatchKind::Ok,
        1,
        "a|b|c",
    );
    // INTO09
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Then {
                patterns: vec![string_type(), string_type(), string_type()],
            }),
        },
        json!([["a", "b", 3]]),
        MatchKind::Fail,
        0,
        "",
    );
}

fn furthest_fail_origin(root: &PatternMatch<'_>) -> crate::provenance::Origin {
    let mut best = root.origin;
    let mut pending: Vec<_> = root.children.iter().copied().collect();
    while let Some(node) = pending.pop() {
        if node.kind == MatchKind::Fail && node.origin.start > best.start {
            best = node.origin;
        }
        pending.extend(node.children.iter().copied());
    }
    best
}

#[test]
// req:into-001
fn port_into_spans_nested_items_by_their_origins() {
    // INTO12
    uffda_heap::rootless_mutate(|mc| {
        let element =
            Value::string(mc, "!").wrap(mc, crate::provenance::Origin { start: 5, end: 6 });
        let item = Value::array(mc, vec![element])
            .wrap(mc, crate::provenance::Origin { start: 5, end: 7 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(literal(json!("b"))),
            },
            vec![item],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(furthest_fail_origin(&result).start, 5);
    });
}

#[test]
// req:into-001
fn port_into_spans_string_characters_by_their_origins() {
    // INTO13
    uffda_heap::rootless_mutate(|mc| {
        let origin = crate::provenance::Origin { start: 20, end: 22 };
        let item = Value::Located(uffda_heap::Gc::new(
            mc,
            crate::provenance::Located {
                raw: Value::string(mc, "ab"),
                origin,
                chars: vec![crate::provenance::CharRun {
                    length: 2,
                    origin,
                    linear: true,
                }],
            },
        ));
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Then {
                    patterns: vec![literal(json!("a")), literal(json!("c"))],
                }),
            },
            vec![item],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(furthest_fail_origin(&result).start, 21);
    });
}

#[test]
// req:into-001 req:quantifier-001
fn port_into_opens_only_the_last_item_of_an_open_input() {
    let inner_kinds = |items: &[&str], open: bool| {
        uffda_heap::rootless_mutate(|mc| {
            let pattern = Pattern::Into {
                pattern: Box::new(quantifier(string_type(), None, None)),
            };
            let input = items.iter().map(|item| Value::string(mc, *item)).collect();
            let environment = Environment::new(mc, None, vec![]);
            let mut execution = if open {
                PatternExecution::new_open(mc, pattern, input, environment)
            } else {
                PatternExecution::new(mc, pattern, input, environment)
            };
            finish(mc, &mut execution);
            let result = execution.result().unwrap();
            assert_eq!(result.kind, MatchKind::Ok);
            result.children[0]
                .children
                .iter()
                .map(|child| child.kind)
                .collect::<Vec<_>>()
        })
    };
    assert_eq!(
        inner_kinds(&["ab"], true),
        vec![MatchKind::Ok, MatchKind::Ok, MatchKind::Fail]
    );
    assert_eq!(
        inner_kinds(&["ab", "c"], true),
        vec![MatchKind::Ok, MatchKind::Ok]
    );
    assert_eq!(
        inner_kinds(&["ab"], false),
        vec![MatchKind::Ok, MatchKind::Ok]
    );
}

#[test]
// req:into-001
fn port_into_carries_the_wrapped_nested_element() {
    uffda_heap::rootless_mutate(|mc| {
        let element = Value::Number(1.0).wrap(mc, crate::provenance::Origin { start: 5, end: 6 });
        let item = Value::array(mc, vec![element])
            .wrap(mc, crate::provenance::Origin { start: 4, end: 7 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(literal(json!(1))),
            },
            vec![item],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.same_wrapper(element));
    });
}

#[test]
// req:into-001 req:skip-002
fn port_into_forwards_a_skipped_inner_match() {
    // INTO_SKIP00
    assert_item(
        Pattern::Into {
            pattern: Box::new(Pattern::Skip {
                pattern: Box::new(quantifier(Pattern::Any, None, None)),
            }),
        },
        json!([["a", "b"]]),
        MatchKind::Skip,
        1,
        "undefined",
    );
}

#[test]
// req:into-001
fn port_into_rejects_null_and_a_non_string_character_class() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Any),
            },
            vec![Value::Null],
            Environment::new(mc, None, vec![]),
        );
        let error = drive(mc, &mut execution).unwrap_err();
        assert_eq!(error, PatternError::IterableExpected);
        assert!(error.to_string().contains("expected value to be iterable"));

        let mut execution = PatternExecution::new(
            mc,
            Pattern::Into {
                pattern: Box::new(Pattern::Character {
                    character_class: "L".into(),
                }),
            },
            vec![Value::array(mc, vec![Value::Number(7.0)])],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err().to_string(),
            "expected value to be a string for character class but got number"
        );
    });
}

fn lit_source(value: serde_json::Value) -> ValueSource {
    ValueSource::Literal {
        value: LiteralValue::Present(value.into()),
    }
}

fn values_case(values: Vec<ValueSource>, pattern: Pattern) -> SwitchCase {
    SwitchCase {
        key: SwitchKey::Values { values },
        pattern: Box::new(pattern),
    }
}

#[test]
// req:switch-001
fn port_switch_dispatches_on_literal_and_character_class_keys() {
    // SWITCH00
    assert_item(
        Pattern::Switch {
            cases: vec![values_case(
                vec![lit_source(json!("#"))],
                literal(json!("#")),
            )],
            default: None,
        },
        json!("#"),
        MatchKind::Ok,
        1,
        "#",
    );
    // SWITCH01
    assert_item(
        Pattern::Switch {
            cases: vec![SwitchCase {
                key: SwitchKey::CharacterClass {
                    character_class: "L".into(),
                },
                pattern: Box::new(Pattern::Any),
            }],
            default: None,
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
}

#[test]
// req:switch-003
fn port_switch_uses_default_only_when_no_key_matches() {
    // SWITCH02
    assert_item(
        Pattern::Switch {
            cases: vec![values_case(
                vec![lit_source(json!("#"))],
                literal(json!("#")),
            )],
            default: None,
        },
        json!("a"),
        MatchKind::Fail,
        0,
        "",
    );
    // SWITCH03
    assert_item(
        Pattern::Switch {
            cases: vec![values_case(
                vec![lit_source(json!("#"))],
                literal(json!("#")),
            )],
            default: Some(Box::new(Pattern::Any)),
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
    // SWITCH04: end of input fails even when a default is declared.
    assert_item(
        Pattern::Switch {
            cases: vec![],
            default: Some(Box::new(Pattern::Any)),
        },
        json!([]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        Pattern::Switch {
            cases: vec![],
            default: None,
        },
        json!("a"),
        MatchKind::Fail,
        0,
        "",
    );
}

#[test]
// req:switch-001 req:switch-004
fn port_switch_resolves_a_variable_key() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Switch {
                cases: vec![values_case(
                    vec![ValueSource::Variable { name: "a".into() }],
                    Pattern::Any,
                )],
                default: None,
            },
            vec![Value::string(mc, "x")],
            Environment::new(mc, None, vec![("a".into(), Value::string(mc, "x"))]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(item_text(result.value), "x");
    });
}

#[test]
// req:switch-002
fn port_switch_does_not_fall_through_after_a_chosen_body_fails() {
    assert_item(
        Pattern::Switch {
            cases: vec![
                values_case(vec![lit_source(json!("a"))], literal(json!("z"))),
                values_case(vec![lit_source(json!("a"))], literal(json!("a"))),
            ],
            default: None,
        },
        json!("a"),
        MatchKind::Fail,
        0,
        "",
    );
}

#[test]
// req:switch-004
fn port_switch_reports_an_unknown_character_class() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Switch {
                cases: vec![SwitchCase {
                    key: SwitchKey::CharacterClass {
                        character_class: "?".into(),
                    },
                    pattern: Box::new(Pattern::Any),
                }],
                default: None,
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![]),
        );
        assert!(matches!(
            drive(mc, &mut execution).unwrap_err(),
            PatternError::InvalidArgument(_)
        ));
    });
}

#[test]
// req:switch-004
fn port_switch_type_error_matches_the_character_pattern() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Switch {
                cases: vec![SwitchCase {
                    key: SwitchKey::CharacterClass {
                        character_class: "L".into(),
                    },
                    pattern: Box::new(Pattern::Any),
                }],
                default: Some(Box::new(Pattern::Fail)),
            },
            vec![Value::Number(1.0)],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err().to_string(),
            "expected value to be a string for character class but got number"
        );
    });
}

#[test]
// req:switch-004
fn port_switch_reports_an_unbound_key_reference() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Switch {
                cases: vec![values_case(
                    vec![ValueSource::Variable {
                        name: "unbound".into(),
                    }],
                    Pattern::Any,
                )],
                default: None,
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![]),
        );
        assert_eq!(
            drive(mc, &mut execution).unwrap_err(),
            PatternError::UnknownValueReference("unbound".into())
        );
    });
}

#[test]
// req:switch-001
fn port_switch_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "#").wrap(mc, crate::provenance::Origin { start: 4, end: 5 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Switch {
                cases: vec![values_case(vec![lit_source(json!("#"))], Pattern::Any)],
                default: None,
            },
            vec![item],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.same_wrapper(item));
    });
}

#[test]
// req:switch-001 req:skip-002
fn port_switch_forwards_a_skipped_chosen_case() {
    assert_item(
        Pattern::Switch {
            cases: vec![values_case(
                vec![lit_source(json!("a"))],
                Pattern::Skip {
                    pattern: Box::new(literal(json!("a"))),
                },
            )],
            default: None,
        },
        json!("a"),
        MatchKind::Skip,
        1,
        "undefined",
    );
}

fn describe(value: Value<'_>) -> String {
    match value.raw() {
        Value::Undefined => "undefined".into(),
        Value::Null => "null".into(),
        Value::Boolean(value) => value.to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => text.to_utf8().unwrap(),
        Value::Array(items) => {
            let parts = items
                .borrow()
                .iter()
                .copied()
                .map(describe)
                .collect::<Vec<_>>()
                .join(",");
            format!("[{parts}]")
        }
        Value::Object(properties) => {
            let parts = properties
                .borrow()
                .entries()
                .iter()
                .map(|(key, value)| {
                    format!(
                        "{}:{}",
                        key.as_string()
                            .and_then(|key| key.as_scalar_str())
                            .expect("scalar key"),
                        describe(*value)
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{parts}}}")
        }
        other => panic!("unexpected match value {:?}", other.runtime_type()),
    }
}

fn matched(pattern: Pattern, input: serde_json::Value) -> (MatchKind, usize, String) {
    let mut runtime =
        crate::runtime::Runtime::for_pattern(pattern, input, crate::runtime::InputMode::Iterable)
            .unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        let text = if result.kind == MatchKind::Fail {
            String::new()
        } else {
            describe(result.value)
        };
        (result.kind, result.end, text)
    })
}

fn number_type() -> Pattern {
    Pattern::Type {
        expected: RuntimeType::Number,
    }
}

fn rest_pattern(entry: Option<&str>, key: Pattern, value: Pattern) -> OverRestClause {
    OverRestClause::Pattern {
        entry: entry.map(str::to_string),
        key: Box::new(key),
        value: Box::new(value),
    }
}

#[test]
// req:over-001
fn port_over_matches_declared_object_keys() {
    let empty = Pattern::Over {
        keys: Some(vec![]),
        rest: None,
    };
    // OBJECT00
    assert_eq!(matched(empty, json!([{}])), (MatchKind::Ok, 1, "{}".into()));
    // OBJECT01
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![]),
                rest: None,
            },
            json!([{ "x": "a" }])
        ),
        (MatchKind::Ok, 1, "{x:a}".into())
    );
    // OBJECT02
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![("x".into(), string_type())]),
                rest: None,
            },
            json!([{ "x": "a" }])
        ),
        (MatchKind::Ok, 1, "{x:a}".into())
    );
    // OBJECT03
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![("x".into(), string_type())]),
                rest: None,
            },
            json!([{}])
        ),
        (MatchKind::Fail, 0, String::new())
    );
    // OBJECT04
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![
                    ("type".into(), literal(json!("x"))),
                    ("value".into(), literal(json!("y"))),
                ]),
                rest: None,
            },
            json!([{ "type": "x", "value": "y" }])
        ),
        (MatchKind::Ok, 1, "{type:x,value:y}".into())
    );
}

#[test]
// req:over-001
fn port_over_places_a_key_failure_on_the_property_path() {
    // OBJECT05
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![("x".into(), literal(json!("expected")))]),
                rest: None,
            },
            vec![Value::object(
                mc,
                vec![("x".into(), Value::string(mc, "actual"))],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
        assert_eq!(
            result.children[0]
                .identity
                .position(result.children[0].start)
                .to_string(),
            "[0].\"x\".[0]"
        );
    });
}

#[test]
// req:over-002
fn port_over_matches_undeclared_object_entries() {
    // Claims matching entries, then accepts the rest with a catch-all.
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![("id".into(), number_type())]),
                rest: Some(vec![
                    rest_pattern(None, literal(json!("name")), string_type()),
                    OverRestClause::Any,
                ]),
            },
            json!([{ "id": 42, "name": "Ada", "active": true }])
        ),
        (MatchKind::Ok, 1, "{id:42,name:Ada,active:true}".into())
    );

    // A value pattern sees the binding captured by the key pattern.
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(
                    None,
                    Pattern::Variable {
                        name: "key".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                    Pattern::Equal {
                        value: ValueSource::Variable { name: "key".into() },
                    },
                )]),
            },
            json!([{ "answer": "answer" }])
        ),
        (MatchKind::Ok, 1, "{answer:answer}".into())
    );

    uffda_heap::rootless_mutate(|mc| {
        let pattern = || Pattern::Over {
            keys: Some(vec![]),
            rest: Some(vec![rest_pattern(
                Some("entry"),
                Pattern::Variable {
                    name: "key".into(),
                    pattern: Box::new(string_type()),
                },
                Pattern::Variable {
                    name: "value".into(),
                    pattern: Box::new(string_type()),
                },
            )]),
        };
        let mut execution = PatternExecution::new(
            mc,
            pattern(),
            vec![Value::object(
                mc,
                vec![
                    ("a".into(), Value::string(mc, "x")),
                    ("b".into(), Value::string(mc, "y")),
                ],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(
            describe(result.environment.get("entry").unwrap()),
            "[[a,x],[b,y]]"
        );
        assert_eq!(describe(result.environment.get("key").unwrap()), "[a,b]");
        assert_eq!(describe(result.environment.get("value").unwrap()), "[x,y]");

        let mut execution = PatternExecution::new(
            mc,
            pattern(),
            vec![Value::object(mc, vec![])],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.environment.get("entry").is_none());
        assert!(result.environment.get("key").is_none());
        assert!(result.environment.get("value").is_none());
    });

    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![
                    rest_pattern(None, literal(json!("expected")), Pattern::Any),
                    OverRestClause::Any,
                ]),
            },
            json!([{ "actual": "value" }])
        ),
        (MatchKind::Ok, 1, "{actual:value}".into())
    );

    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![
                    rest_pattern(
                        None,
                        string_type(),
                        Pattern::Variable {
                            name: "first".into(),
                            pattern: Box::new(string_type()),
                        },
                    ),
                    rest_pattern(
                        None,
                        Pattern::Variable {
                            name: "key".into(),
                            pattern: Box::new(string_type()),
                        },
                        Pattern::Variable {
                            name: "value".into(),
                            pattern: Box::new(Pattern::Any),
                        },
                    ),
                ]),
            },
            vec![Value::object(mc, vec![("a".into(), Value::Number(1.0))])],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.environment.get("first").is_none());
        assert_eq!(describe(result.environment.get("key").unwrap()), "[a]");
        assert_eq!(describe(result.environment.get("value").unwrap()), "[1]");
    });

    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(None, string_type(), string_type())]),
            },
            json!([{ "actual": 42 }])
        ),
        (MatchKind::Fail, 0, String::new())
    );
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(
                    None,
                    literal(json!("expected")),
                    Pattern::Any,
                )]),
            },
            json!([{ "actual": "value" }])
        ),
        (MatchKind::Fail, 0, String::new())
    );
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![("id".into(), number_type())]),
                rest: Some(vec![rest_pattern(None, Pattern::Fail, Pattern::Fail)]),
            },
            json!([{ "id": 42 }])
        ),
        (MatchKind::Ok, 1, "{id:42}".into())
    );

    // Rest clauses visit symbol-keyed entries as native association entries.
    uffda_heap::rootless_mutate(|mc| {
        let source = Value::object(mc, vec![]);
        let Value::Object(properties) = source else {
            unreachable!()
        };
        properties
            .borrow_mut(mc)
            .set_symbol("hidden".into(), Value::string(mc, "value"));
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(None, Pattern::Fail, Pattern::Fail)]),
            },
            vec![source],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
    });
}

#[test]
// req:over-002
fn port_over_matches_object_rest_entries() {
    uffda_heap::rootless_mutate(|mc| {
        let value = Value::association(
            mc,
            vec![
                (Value::Number(3.0), Value::string(mc, "three")),
                (Value::string(mc, "name"), Value::string(mc, "Ada")),
            ],
        );
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![
                    rest_pattern(None, number_type(), string_type()),
                    OverRestClause::Any,
                ]),
            },
            vec![value],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.strict_eq(value));
        assert_eq!(result.children.len(), 3);

        let key = Value::object(mc, vec![]);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(
                    None,
                    Pattern::Variable {
                        name: "entryKey".into(),
                        pattern: Box::new(Pattern::Any),
                    },
                    Pattern::Equal {
                        value: ValueSource::Variable {
                            name: "entryKey".into(),
                        },
                    },
                )]),
            },
            vec![Value::association(mc, vec![(key, key)])],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);

        let value = Value::association(
            mc,
            vec![
                (Value::string(mc, "id"), Value::Number(1.0)),
                (Value::string(mc, "extra"), Value::Number(2.0)),
            ],
        );
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![("id".into(), number_type())]),
                rest: Some(vec![
                    rest_pattern(None, literal(json!("extra")), number_type()),
                    OverRestClause::Any,
                ]),
            },
            vec![value],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.strict_eq(value));
        assert_eq!(result.children.len(), 3);

        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(
                    None,
                    Pattern::Type {
                        expected: RuntimeType::Symbol,
                    },
                    number_type(),
                )]),
            },
            vec![Value::association(
                mc,
                vec![(
                    Value::Symbol(uffda_heap::Gc::new(mc, "map-rest-key".into())),
                    Value::Number(1.0),
                )],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);

        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(None, number_type(), Pattern::Fail)]),
            },
            vec![Value::association(
                mc,
                vec![(Value::Number(1.0), Value::Number(2.0))],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);

        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![]),
                rest: Some(vec![rest_pattern(None, number_type(), Pattern::Any)]),
            },
            vec![Value::association(
                mc,
                vec![(Value::string(mc, "name"), Value::string(mc, "Ada"))],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);

        let value = Value::association(mc, vec![(Value::string(mc, "id"), Value::Number(1.0))]);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![("id".into(), number_type())]),
                rest: Some(vec![rest_pattern(None, Pattern::Fail, Pattern::Fail)]),
            },
            vec![value],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.strict_eq(value));
    });
}

#[test]
// req:over-001
fn port_over_carries_a_wrapped_object() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::object(
            mc,
            vec![(
                "x".into(),
                Value::Number(1.0).wrap(mc, crate::provenance::Origin { start: 5, end: 6 }),
            )],
        )
        .wrap(mc, crate::provenance::Origin { start: 4, end: 7 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![("x".into(), literal(json!(1)))]),
                rest: None,
            },
            vec![item],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.value.same_wrapper(item));
    });
}

#[test]
// req:over-001 req:skip-002
fn port_over_keeps_the_object_when_a_field_is_skipped() {
    // OVER_SKIP00
    assert_eq!(
        matched(
            Pattern::Over {
                keys: Some(vec![(
                    "a".into(),
                    Pattern::Skip {
                        pattern: Box::new(Pattern::Any),
                    },
                )]),
                rest: None,
            },
            json!([{ "a": 1 }])
        ),
        (MatchKind::Ok, 1, "{a:1}".into())
    );
}

#[test]
// req:over-001
fn port_over_gives_each_key_its_own_stream_positions() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Over {
                keys: Some(vec![("a".into(), Pattern::Any), ("b".into(), Pattern::Any)]),
                rest: None,
            },
            vec![Value::object(
                mc,
                vec![
                    ("a".into(), Value::Number(1.0)),
                    ("b".into(), Value::Number(2.0)),
                ],
            )],
            Environment::new(mc, None, vec![]),
        );
        finish(mc, &mut execution);
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        let paths = result
            .children
            .iter()
            .map(|child| child.identity.position(child.end).to_string())
            .collect::<Vec<_>>();
        assert_eq!(
            paths,
            vec!["[0].\"a\".[1]".to_string(), "[0].\"b\".[1]".to_string()]
        );
    });
}

fn equal_text(text: &str) -> Pattern {
    literal(json!(text))
}

fn until_semicolon() -> Pattern {
    Pattern::Quantifier {
        pattern: Box::new(Pattern::Then {
            patterns: vec![
                Pattern::Not {
                    pattern: Box::new(equal_text(";")),
                },
                Pattern::Any,
            ],
        }),
        min: literal_bound(1.0),
        max: None,
    }
}

fn statement() -> Pattern {
    Pattern::Recover {
        pattern: Box::new(Pattern::Then {
            patterns: vec![equal_text("a"), equal_text("b")],
        }),
        skip: Box::new(until_semicolon()),
    }
}

fn chars<'gc>(mc: &uffda_heap::Mutation<'gc>, text: &str) -> Vec<Value<'gc>> {
    text.chars()
        .map(|ch| Value::string(mc, ch.to_string()))
        .collect()
}

fn recover_match<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    pattern: Pattern,
    text: &str,
    enabled: bool,
) -> uffda_heap::Gc<'gc, PatternMatch<'gc>> {
    let recovery = RecoveryContext::new(mc);
    let recovery = if enabled { recovery.enable() } else { recovery };
    let mut execution = PatternExecution::new_with_recovery(
        mc,
        pattern,
        chars(mc, text),
        Environment::new(mc, None, vec![]),
        recovery,
    );
    while !execution.step(mc).unwrap() {}
    execution.result().unwrap()
}

#[test]
// req:recover-001
fn port_recover_uses_the_child_when_it_succeeds_or_recovery_is_off() {
    uffda_heap::rootless_mutate(|mc| {
        // RECOVER00
        let result = recover_match(mc, statement(), "ab", false);
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(!result.recovered);
        assert_eq!(result.end, 2);
        assert_eq!(describe(result.value), "[a,b]");

        // RECOVER01
        let result = recover_match(mc, statement(), "ax;", false);
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
        assert!(!result.recovered);
    });
}

#[test]
// req:recover-001 req:error-recovery-002
fn port_recover_marks_a_successful_skip_and_continues() {
    uffda_heap::rootless_mutate(|mc| {
        // RECOVER02
        let result = recover_match(mc, statement(), "ax;", true);
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
        assert!(result.recovery.is_enabled());
        assert_eq!(result.start, 0);
        assert_eq!(result.end, 2);
        assert_eq!(describe(result.value), "[[undefined,a],[undefined,x]]");
        assert_eq!(
            result
                .children
                .iter()
                .map(|child| child.kind)
                .collect::<Vec<_>>(),
            vec![MatchKind::Fail, MatchKind::Ok]
        );

        // RECOVER03
        let result = recover_match(mc, statement(), "ab", true);
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(!result.recovered);
        assert_eq!(describe(result.value), "[a,b]");

        // RECOVER06
        let result = recover_match(
            mc,
            Pattern::Then {
                patterns: vec![statement(), equal_text(";"), statement()],
            },
            "ax;yy",
            true,
        );
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
        assert_eq!(result.end, 5);
    });
}

#[test]
// req:recover-001 req:error-recovery-004
fn port_recover_fails_a_zero_width_skip_and_disables_recovery_for_it() {
    uffda_heap::rootless_mutate(|mc| {
        // RECOVER04
        let result = recover_match(mc, statement(), ";", true);
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.start, 0);
        assert_eq!(result.end, 0);

        // RECOVER05: the skip pattern is itself a recover, matched with recovery off.
        let result = recover_match(
            mc,
            Pattern::Recover {
                pattern: Box::new(equal_text("a")),
                skip: Box::new(Pattern::Recover {
                    pattern: Box::new(equal_text("z")),
                    skip: Box::new(until_semicolon()),
                }),
            },
            "x;",
            true,
        );
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, 0);
    });
}

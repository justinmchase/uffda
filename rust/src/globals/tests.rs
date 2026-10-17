use super::*;

#[test]
// req:runtime-core-014
fn external_input_iterator_creation_does_not_pull_or_require_an_executor() {
    uffda_heap::rootless_mutate(|mc| {
        let source = crate::runtime::input::InputSource::new(
            mc,
            crate::runtime::input::Source {
                id: 1,
                name: "source".into(),
            },
        );
        let iterator = iterator(mc, Value::InputSource(source)).unwrap();
        assert!(matches!(
            &*iterator.borrow(),
            IterableState::External { index: 0, .. }
        ));
        assert!(!source.pending());
        assert!(source.prefix().is_empty());
    });
}
use crate::environment::Environment;
use crate::evaluate::Evaluation;
use crate::expression::{ArrayInitializer, Expression, InvocationArgument};
use crate::value::RuntimeType;
use serde_json::json;
use uffda_heap::rootless_mutate;

#[test]
// req:runtime-strings-002
fn shared_lossless_strings_cover_globals_iteration_and_property_lookup() {
    #[derive(serde::Deserialize)]
    struct Fixture {
        source: String,
        units: Vec<u16>,
    }
    let fixtures: Vec<Fixture> =
        serde_json::from_str(include_str!("../../../test/rust/string-fixtures.json")).unwrap();
    for fixture in fixtures {
        let text = RuntimeString::from_json_string(&fixture.source).unwrap();
        let literal = || Expression::Value {
            value: Some(crate::json::JsonValue::String(text.clone())),
        };
        assert_eq!(
            evaluate(call("length", vec![literal()])),
            fixture.units.len().to_string()
        );
        for (index, unit) in fixture.units.iter().enumerate() {
            let expected = serde_json::to_string(&RuntimeString::from_utf16(vec![*unit])).unwrap();
            assert_eq!(
                evaluate(call("at", vec![literal(), super_literal(index)])),
                expected
            );
            assert_eq!(
                evaluate(call(
                    "slice",
                    vec![literal(), super_literal(index), super_literal(index + 1)]
                )),
                expected
            );
        }
        let spread = Expression::Array {
            expressions: vec![ArrayInitializer::ArraySpread {
                expression: literal(),
            }],
        };
        let expected = crate::json::JsonValue::Array(
            text.code_points()
                .map(|point| {
                    crate::json::JsonValue::String(RuntimeString::from_utf16(point.to_vec()))
                })
                .collect(),
        );
        assert_eq!(evaluate(spread), serde_json::to_string(&expected).unwrap());
        let object = Expression::Object {
            keys: vec![crate::expression::ObjectInitializer::ObjectKey {
                name: text.clone(),
                expression: literal(),
            }],
        };
        assert_eq!(evaluate(call("has", vec![object, literal()])), "true");
    }
    fn super_literal(index: usize) -> Expression {
        Expression::Number {
            value: index as f64,
        }
    }
}

#[test]
// req:runtime-strings-002
fn lossless_join_format_compare_symbols_and_scalar_hash_errors() {
    let high = || Expression::Value {
        value: Some(crate::json::JsonValue::String(RuntimeString::from_utf16(
            vec![0xd800],
        ))),
    };
    let low = || Expression::Value {
        value: Some(crate::json::JsonValue::String(RuntimeString::from_utf16(
            vec![0xdc00],
        ))),
    };
    let array = Expression::Array {
        expressions: vec![
            ArrayInitializer::ArrayElement { expression: high() },
            ArrayInitializer::ArrayElement { expression: low() },
        ],
    };
    assert_eq!(
        evaluate(call("join", vec![array, literal(json!(""))])),
        "\"𐀀\""
    );
    assert_eq!(
        evaluate(call(
            "format",
            vec![literal(json!("{0}{1}")), high(), low()]
        )),
        "\"𐀀\""
    );
    assert_eq!(
        evaluate(call("compare", vec![high(), literal(json!("\u{e000}"))])),
        "-1"
    );
    assert_eq!(
        evaluate(Expression::String {
            values: vec![crate::expression::StringSegment::Expression(call(
                "symbol",
                vec![high()]
            ))]
        }),
        r#""Symbol(\ud800)""#
    );
    assert!(matches!(
        Evaluation::new(call("sha256", vec![high()])).finish(),
        Err(EvaluationError::StringCoercion(
            crate::coercion::StringCoercionError::NonScalarText
        ))
    ));
}

#[test]
// req:runtime-core-012 req:expressions-runtime-004
fn scalar_symbol_descriptor_is_shared_by_interpolation_format_and_join() {
    let symbol = || call("symbol", vec![literal(json!("iterator"))]);
    let ast: Expression = serde_json::from_value(json!({
        "kind":"string","values":["value=",{"kind":"invocation",
            "expression":{"kind":"reference","name":"symbol"},"args":[{"kind":"value","value":"iterator"}]}]
    })).unwrap();
    assert_eq!(evaluate(ast), r#""value=Symbol(Symbol.iterator)""#);
    assert_eq!(
        evaluate(call("format", vec![literal(json!("{0}")), symbol()])),
        r#""Symbol(Symbol.iterator)""#
    );
    assert_eq!(
        evaluate(call(
            "join",
            vec![Expression::Array {
                expressions: vec![ArrayInitializer::ArrayElement {
                    expression: symbol()
                },]
            }]
        )),
        r#""Symbol(Symbol.iterator)""#
    );
}

#[test]
// req:runtime-core-012 req:expressions-runtime-004
fn scalar_text_globals_reject_composites_and_callable_values() {
    let authored = json!({
        "kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":1}
    });
    for value in [
        json!({"kind":"reference","name":"add"}),
        authored,
        json!({"kind":"value","value":[]}),
        json!({"kind":"value","value":{}}),
    ] {
        for ast in [
            call(
                "format",
                vec![
                    literal(json!("{0}")),
                    serde_json::from_value(value.clone()).unwrap(),
                ],
            ),
            call("int", vec![serde_json::from_value(value.clone()).unwrap()]),
            call(
                "join",
                vec![
                    Expression::Array {
                        expressions: vec![ArrayInitializer::ArrayElement {
                            expression: serde_json::from_value(value.clone()).unwrap(),
                        }],
                    },
                    literal(json!(",")),
                ],
            ),
            call(
                "join",
                vec![literal(json!([])), serde_json::from_value(value).unwrap()],
            ),
        ] {
            assert!(matches!(
                Evaluation::new(ast).finish(),
                Err(EvaluationError::StringCoercion(_))
            ));
        }
    }
    assert_eq!(
        evaluate(call(
            "join",
            vec![literal(json!(["a", 1, true, null])), literal(json!("|"))]
        )),
        r#""a|1|true|""#
    );
    assert_eq!(evaluate(call("int", vec![literal(json!("42tail"))])), "42");
}

#[test]
// req:runtime-core-012 req:runtime-core-013
fn direct_json_serializer_rejects_callable_roots_elements_and_properties() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let authored = crate::evaluate::CompiledExpression::new(literal(json!(1))).bind(
            mc,
            Environment::new(mc, None, vec![]),
            origin,
            crate::pattern::Pattern::End,
        );
        for callable in [
            Value::Native(NativeGlobal::Add),
            Value::host(
                mc,
                crate::value::HostCallable {
                    id: 1,
                    name: "private".into(),
                    arity: 0,
                },
            ),
            authored,
            Value::IteratorFactory(Gc::new(mc, Value::array(mc, vec![]))),
        ] {
            for value in [
                callable,
                Value::array(mc, vec![Value::Null, callable]),
                Value::object(mc, vec![("hidden".into(), callable)]),
            ] {
                assert!(
                    matches!(json_text(value), Err(EvaluationError::Native(message)) if message == "cannot serialize callable to JSON")
                );
                assert!(invoke(mc, NativeGlobal::Json, vec![value], origin).is_err());
            }
        }
        assert_eq!(
            json_text(Value::array(mc, vec![Value::Undefined, Value::Null])).unwrap(),
            Some("[null,null]".into())
        );
        assert_eq!(
            json_text(Value::object(
                mc,
                vec![("data".into(), Value::Number(42.0))]
            ))
            .unwrap(),
            Some(r#"{"data":42}"#.into())
        );
    });
}

#[test]
// req:data-codec-003 req:expressions-runtime-007 req:standard-library-002
fn json_serializer_handles_dates_errors_and_rejects_bigint_without_data_codec() {
    rootless_mutate(|mc| {
        let date = Value::date(mc, time::OffsetDateTime::UNIX_EPOCH);
        let error = Value::error(mc, "TypeError".into(), "invalid".into(), None, None);
        let bigint = Value::bigint(mc, num_bigint::BigInt::from(1));
        assert_eq!(
            json_text(date).unwrap().as_deref(),
            Some("\"1970-01-01T00:00:00Z\"")
        );
        assert_eq!(json_text(error).unwrap().as_deref(), Some("{}"));
        assert!(
            matches!(json_text(bigint), Err(EvaluationError::Native(message)) if message.contains("BigInt"))
        );
    });
}

#[test]
// req:runtime-strings-001 req:expressions-runtime-005
fn indexing_and_slicing_preserve_isolated_surrogates() {
    assert_eq!(
        evaluate(call("at", vec![literal(json!("😀")), literal(json!(0))])),
        r#""\ud83d""#
    );
    assert_eq!(
        evaluate(call(
            "slice",
            vec![literal(json!("😀")), literal(json!(1)), literal(json!(2))]
        )),
        r#""\ude00""#
    );
    let expression = crate::json::from_str(r#"{"kind":"value","value":"\ud83d"}"#).unwrap();
    assert_eq!(evaluate(expression), r#""\ud83d""#);
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-007 req:standard-library-001 req:standard-library-002
fn native_callable_own_fields_match_all_typescript_names_and_arities() {
    #[derive(serde::Deserialize)]
    struct Fixture {
        name: String,
        arity: usize,
    }
    let fixtures: Vec<Fixture> = serde_json::from_str(include_str!(
        "../../../test/rust/globals-surface-fixtures.json"
    ))
    .unwrap();
    assert_eq!(GLOBALS.len(), fixtures.len());
    let actual_names = GLOBALS
        .iter()
        .map(|(name, _)| name.to_string())
        .collect::<std::collections::HashSet<_>>();
    let expected_names = fixtures
        .iter()
        .map(|fixture| fixture.name.clone())
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(actual_names, expected_names);
    assert_eq!(expected_names.len(), fixtures.len());
    fn collect_invocations(
        value: &serde_json::Value,
        names: &mut std::collections::HashSet<String>,
    ) {
        match value {
            serde_json::Value::Array(items) => {
                for item in items {
                    collect_invocations(item, names);
                }
            }
            serde_json::Value::Object(object) => {
                if object.get("kind").and_then(serde_json::Value::as_str) == Some("invocation")
                    && let Some(name) = object
                        .get("expression")
                        .and_then(|expression| expression.get("name"))
                        .and_then(serde_json::Value::as_str)
                {
                    names.insert(name.to_string());
                }
                for item in object.values() {
                    collect_invocations(item, names);
                }
            }
            _ => {}
        }
    }
    let behavior_fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../test/rust/globals-fixtures.json")).unwrap();
    let mut behavior_names = std::collections::HashSet::new();
    for fixture in behavior_fixtures.as_array().unwrap() {
        behavior_names.insert(fixture["name"].as_str().unwrap().to_string());
        if let Some(expressions) = fixture.get("expressions") {
            collect_invocations(expressions, &mut behavior_names);
        }
    }
    assert_eq!(behavior_names, expected_names);
    let mut behavior_case_counts = std::collections::HashMap::<String, usize>::new();
    for fixture in behavior_fixtures.as_array().unwrap() {
        let mut names = std::collections::HashSet::new();
        names.insert(fixture["name"].as_str().unwrap().to_string());
        if let Some(expressions) = fixture.get("expressions") {
            collect_invocations(expressions, &mut names);
        }
        for name in names {
            *behavior_case_counts.entry(name).or_insert(0) += 1;
        }
    }
    for fixture in &fixtures {
        assert!(
            behavior_case_counts
                .get(&fixture.name)
                .copied()
                .unwrap_or(0)
                >= 2,
            "{} needs at least two shared behavior cases",
            fixture.name
        );
    }
    for fixture in fixtures {
        let global = lookup(&fixture.name).expect("fixture global exists");
        assert_eq!(global.name(), fixture.name.as_str());
        assert_eq!(global.arity(), fixture.arity);
        assert!(
            !global.metadata().description.is_empty(),
            "{} has no description",
            fixture.name
        );
        assert_eq!(
            evaluate(Expression::Member {
                name: "name".into(),
                expression: Box::new(reference(&fixture.name)),
            }),
            serde_json::to_string(&fixture.name).unwrap()
        );
        assert_eq!(
            evaluate(Expression::Member {
                name: "length".into(),
                expression: Box::new(reference(&fixture.name)),
            }),
            fixture.arity.to_string()
        );
    }
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-007 req:runtime-memory-005
fn iterable_normalizer_owns_an_enumerable_factory_with_fresh_array_cursors() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 2 };
        let source =
            Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]).wrap(mc, origin);
        let NativeResult::Value(normalized) =
            invoke(mc, NativeGlobal::Iterable, vec![source], origin).unwrap()
        else {
            unreachable!()
        };
        let Value::Object(object) = normalized.raw() else {
            unreachable!()
        };
        let factory = object.borrow().get_symbol("asyncIterator").unwrap();
        assert_eq!(factory.runtime_type(), RuntimeType::Function);
        for _ in 0..2 {
            let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
                mc,
                normalized,
                Environment::new(mc, None, vec![]),
                origin,
            )
            .unwrap();
            while !execution.step(mc).unwrap() {}
            assert_eq!(
                json_text(execution.result().unwrap()).unwrap().unwrap(),
                "[1,2]"
            );
        }
    });
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn native_symbol_protocol_factories_resume_and_delegate_without_host_recursion() {
    rootless_mutate(|mc| {
        let object = Value::object(mc, vec![]);
        let Value::Object(properties) = object else {
            unreachable!()
        };
        properties.borrow_mut(mc).set_symbol(
            "asyncIterator".into(),
            Value::Native(NativeGlobal::Enumerate),
        );
        let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
            mc,
            object,
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
        )
        .unwrap();
        while !execution.step(mc).unwrap() {}
        assert_eq!(
            json_text(execution.result().unwrap()).unwrap().unwrap(),
            r#"[{"index":0}]"#
        );
    });
}

fn literal(value: serde_json::Value) -> Expression {
    Expression::Value {
        value: Some(value.into()),
    }
}
fn reference(name: &str) -> Expression {
    Expression::Reference { name: name.into() }
}
fn call(name: &str, args: Vec<Expression>) -> Expression {
    Expression::Invocation {
        expression: Box::new(reference(name)),
        args: args
            .into_iter()
            .map(InvocationArgument::Expression)
            .collect(),
    }
}
fn spread(expression: Expression) -> Expression {
    Expression::Array {
        expressions: vec![ArrayInitializer::ArraySpread { expression }],
    }
}
fn evaluate(expression: Expression) -> String {
    let mut evaluation = Evaluation::new(expression);
    loop {
        let done = evaluation.step().unwrap();
        evaluation.collect();
        if done {
            break;
        }
    }
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |v| json_text(v).unwrap().unwrap())
        .unwrap()
}

#[test]
// req:standard-library-002 req:expressions-runtime-005 req:expressions-runtime-007 req:runtime-memory-005
fn shared_native_fixtures_match_typescript_with_collection_between_frames() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../test/rust/globals-fixtures.json")).unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let args = if let Some(expressions) = fixture["expressions"].as_array() {
            expressions
                .iter()
                .cloned()
                .map(|v| serde_json::from_value(v).unwrap())
                .collect()
        } else {
            fixture["args"]
                .as_array()
                .unwrap()
                .iter()
                .cloned()
                .map(literal)
                .collect()
        };
        let ast = call(fixture["name"].as_str().unwrap(), args);
        let ast = if fixture["spread"].as_bool() == Some(true) {
            spread(ast)
        } else {
            ast
        };
        if fixture["error"].as_bool() == Some(true) {
            let mut evaluation = Evaluation::new(ast);
            assert!(evaluation.finish().is_err(), "{}", fixture["name"]);
            continue;
        }
        let actual = evaluate(ast);
        let actual: serde_json::Value = serde_json::from_str(&actual).unwrap();
        let expected = fixture.get("rustExpected").unwrap_or(&fixture["expected"]);
        assert_eq!(&actual, expected, "{}", fixture["name"]);
    }
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-001 req:runtime-memory-005
fn callbacks_are_lazy_resumable_and_compose_through_spread_and_reduce() {
    let mapped = call("map", vec![literal(json!([1, 2, 3])), reference("id")]);
    assert_eq!(evaluate(spread(mapped)), "[1,2,3]");
    let filtered = call(
        "filter",
        vec![literal(json!([0, 1, false, 2])), reference("id")],
    );
    assert_eq!(evaluate(spread(filtered)), "[1,2]");
    let scanned = call(
        "scan",
        vec![
            literal(json!([1, 2, 3])),
            literal(json!(0)),
            reference("add"),
        ],
    );
    let mapped = call("map", vec![scanned, reference("id")]);
    assert_eq!(evaluate(spread(mapped)), "[1,3,6]");
    let enumerated = call("enumerate", vec![literal(json!("😀a"))]);
    assert_eq!(
        evaluate(spread(enumerated)),
        r#"[{"index":0,"value":"😀"},{"index":1,"value":"a"}]"#
    );
    let reduced = call(
        "reduce",
        vec![
            call("iterable", vec![literal(json!([1, 2, 3]))]),
            literal(json!(0)),
            reference("add"),
        ],
    );
    assert_eq!(evaluate(reduced), "6");
    let invalid = call("map", vec![literal(json!([1])), literal(json!(0))]);
    let mut evaluation = Evaluation::new(invalid);
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |v| matches!(v, Value::Iterable(_)))
            .unwrap()
    );
    let mut evaluation = Evaluation::new(spread(call(
        "map",
        vec![literal(json!([1])), literal(json!(0))],
    )));
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::NotCallable
    );
    let mut evaluation = Evaluation::new(call("map", vec![literal(json!(42)), reference("id")]));
    assert!(
        evaluation.finish().is_ok(),
        "source type checks must also be lazy"
    );
    let mut evaluation = Evaluation::new(spread(call(
        "map",
        vec![literal(json!(42)), reference("id")],
    )));
    assert!(matches!(
        evaluation.finish().unwrap_err(),
        EvaluationError::Native(_)
    ));
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-006 req:expressions-runtime-007 req:runtime-core-007 req:runtime-memory-005
fn authored_iterator_factory_and_next_are_invoked_through_continuations() {
    let ast: Expression = serde_json::from_value(json!({
        "kind":"array", "expressions":[{"kind":"arraySpread","expression":{
            "kind":"object","keys":[{"kind":"objectComputedKey",
                "keyExpression":{"kind":"invocation","expression":{"kind":"reference","name":"symbol"},"args":[{"kind":"value","value":"iterator"}]},
                "expression":{"kind":"lambda","pattern":{"kind":"end"},"expression":{
                    "kind":"invocation","expression":{"kind":"reference","name":"iterable"},"args":[{"kind":"value","value":[1,2,3]}]
                }}
            }]
        }}]
    })).unwrap();
    let mut evaluation = Evaluation::new(ast);
    assert!(matches!(
        evaluation.finish(),
        Err(EvaluationError::NotCallable)
    ));
    let empty: Expression = serde_json::from_value(json!({
        "kind":"array", "expressions":[{"kind":"arraySpread","expression":{
            "kind":"object","keys":[{"kind":"objectComputedKey",
                "keyExpression":{"kind":"invocation","expression":{"kind":"reference","name":"symbol"},"args":[{"kind":"value","value":"asyncIterator"}]},
                "expression":{"kind":"lambda","pattern":{"kind":"end"},"expression":{
                    "kind":"object","keys":[{"kind":"objectKey","name":"next","expression":{
                        "kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":{"done":true}}
                    }}]
                }}
            }]
        }}]
    })).unwrap();
    let mut evaluation = Evaluation::new(empty);
    let mut result = None;
    for _ in 0..100 {
        let done = evaluation.step().unwrap();
        evaluation.collect();
        if done {
            result = Some(evaluation.finish().unwrap());
            break;
        }
    }
    let result = result.expect("authored async iterator factory should complete");
    assert_eq!(
        evaluation
            .read(&result, |v| json_text(v).unwrap().unwrap())
            .unwrap(),
        "[]"
    );
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-006
fn enumeration_handles_objects_scalars_and_shared_iterator_exhaustion() {
    assert_eq!(
        evaluate(spread(call(
            "enumerate",
            vec![literal(json!({"a":1,"b":2}))]
        ))),
        r#"[{"index":"a","value":1},{"index":"b","value":2}]"#
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!(null))]))),
        r#"[{"index":0,"value":null}]"#
    );
    let mut evaluation = Evaluation::with_environment(
        Expression::Array {
            expressions: vec![
                ArrayInitializer::ArraySpread {
                    expression: reference("items"),
                },
                ArrayInitializer::ArraySpread {
                    expression: reference("items"),
                },
            ],
        },
        |mc| {
            let items = Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]);
            let iterator = Value::Iterable(iterator(mc, items).unwrap());
            Environment::new(mc, None, vec![("items".into(), iterator)])
        },
    );
    let result = evaluation.finish().unwrap();
    assert_eq!(
        evaluation
            .read(&result, |v| json_text(v).unwrap().unwrap())
            .unwrap(),
        "[1,2]"
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-007 req:cli-exec-001
fn globals_are_first_class_shadowable_and_echo_is_cli_only() {
    assert_eq!(GLOBALS.len(), 36);
    let mut evaluation = Evaluation::with_environment(call("add", vec![]), |mc| {
        Environment::new(mc, None, vec![("add".into(), Value::Undefined)])
    });
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::NotCallable
    );
    let mut evaluation = Evaluation::new(reference("echo"));
    assert!(matches!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference(_)
    ));
    let mut evaluation = Evaluation::with_cli_globals(call("echo", vec![literal(json!(42))]));
    let result = evaluation.finish().unwrap();
    assert_eq!(
        evaluation
            .read(&result, |v| json_text(v).unwrap().unwrap())
            .unwrap(),
        "42"
    );
}

#[test]
// req:expressions-runtime-007 req:runtime-memory-001 req:into-001
fn native_hashing_sets_symbols_and_provenance_follow_existing_contracts() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let invoke_value = |global, args| match invoke(mc, global, args, origin).unwrap() {
            NativeResult::Value(v) => v,
            _ => panic!("expected immediate result"),
        };
        let digest = invoke_value(NativeGlobal::Sha256, vec![Value::string(mc, "abc")]);
        let Value::Bytes(bytes) = digest else {
            panic!("expected bytes");
        };
        assert_eq!(bytes.len(), 32);
        assert_eq!(&bytes[..4], &[0xba, 0x78, 0x16, 0xbf]);
        let encoded = invoke_value(NativeGlobal::Base58, vec![digest]);
        assert_eq!(
            text(encoded).unwrap(),
            "DYu3G8aGTMBW1WrTw76zxQJQU4DHLw9MLyy7peG4LKkY"
        );
        let input = Value::array(
            mc,
            vec![
                Value::Number(f64::NAN),
                Value::Number(f64::NAN),
                Value::Number(-0.0),
                Value::Number(0.0),
            ],
        );
        let set = invoke_value(NativeGlobal::ToSet, vec![input]);
        assert_eq!(length(set).unwrap(), 2);
        assert!(truthy(invoke_value(
            NativeGlobal::Has,
            vec![set, Value::Number(f64::NAN)]
        )));
        let first = invoke_value(NativeGlobal::Symbol, vec![Value::string(mc, "iterator")]);
        let second = invoke_value(NativeGlobal::Symbol, vec![Value::string(mc, "iterator")]);
        assert!(first.strict_eq(second));
        assert!(!first.strict_eq(Value::string(mc, "iterator")));
        let source = Value::string(mc, "abcdef").wrap_root(mc);
        let sliced = invoke_value(
            NativeGlobal::Slice,
            vec![source, Value::Number(2.0), Value::Number(4.0)],
        );
        assert_eq!(sliced.char_origin(0), Some(Origin { start: 2, end: 3 }));
        assert_eq!(text(sliced).unwrap(), "cd");
    });
}

#[test]
// req:runtime-memory-001 req:runtime-strings-002 req:standard-library-002
fn shared_global_identity_and_root_provenance_contracts_match_typescript() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let call_value = |global, args| match invoke(mc, global, args, origin).unwrap() {
            NativeResult::Value(value) => value,
            _ => panic!("expected immediate result"),
        };
        let shared = Value::array(mc, vec![Value::Number(1.0)]);
        let copied = call_value(NativeGlobal::Id, vec![shared]);
        assert!(shared.strict_eq(copied));
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![shared, copied]),
            Value::Boolean(true)
        ));
        let equal_contents = Value::array(mc, vec![Value::Number(1.0)]);
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![shared, equal_contents]),
            Value::Boolean(false)
        ));
        let object = Value::object(mc, vec![("value".into(), Value::Number(1.0))]);
        let equal_object = Value::object(mc, vec![("value".into(), Value::Number(1.0))]);
        assert!(matches!(
            call_value(NativeGlobal::Id, vec![object]),
            copied if copied.strict_eq(object)
        ));
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![object, equal_object]),
            Value::Boolean(false)
        ));
        let map = Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))]);
        let equal_map = Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))]);
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![map, map]),
            Value::Boolean(true)
        ));
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![map, equal_map]),
            Value::Boolean(false)
        ));
        let set = Value::set(mc, vec![Value::Number(1.0)]);
        let equal_set = Value::set(mc, vec![Value::Number(1.0)]);
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![set, set]),
            Value::Boolean(true)
        ));
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![set, equal_set]),
            Value::Boolean(false)
        ));
        assert!(matches!(
            call_value(NativeGlobal::Eq, vec![Value::Null, Value::Undefined]),
            Value::Boolean(false)
        ));
        assert!(call_value(NativeGlobal::Id, vec![Value::Undefined]).strict_eq(Value::Undefined));
        for native in [
            Value::bigint(mc, num_bigint::BigInt::from(123)),
            Value::date(mc, time::OffsetDateTime::UNIX_EPOCH),
            Value::error(mc, "TypeError".into(), "failure".into(), None, None),
            Value::Symbol(uffda_heap::Gc::new(mc, "uffda-native-id".into())),
            Value::Bytes(uffda_heap::Gc::new(mc, vec![1, 2, 3])),
        ] {
            assert!(call_value(NativeGlobal::Id, vec![native]).strict_eq(native));
        }
        let packed = call_value(
            NativeGlobal::Pack,
            vec![Value::Undefined, Value::Null, object, map, set],
        );
        let Value::Array(packed) = packed else {
            panic!("pack must return an array");
        };
        let packed = packed.borrow();
        assert!(packed[0].strict_eq(Value::Undefined));
        assert!(packed[1].strict_eq(Value::Null));
        assert!(packed[2].strict_eq(object));
        assert!(packed[3].strict_eq(map));
        assert!(packed[4].strict_eq(set));
        drop(packed);
        let chosen = Value::object(mc, vec![]);
        let coalesced = call_value(
            NativeGlobal::Coalesce,
            vec![Value::Undefined, Value::Null, chosen],
        );
        assert!(chosen.strict_eq(coalesced));
        assert!(
            call_value(
                NativeGlobal::When,
                vec![Value::Boolean(true), chosen, Value::Null]
            )
            .strict_eq(chosen)
        );
        assert!(
            call_value(
                NativeGlobal::One,
                vec![Value::array(mc, vec![chosen]), Value::Null,]
            )
            .strict_eq(chosen)
        );
        assert!(
            call_value(
                NativeGlobal::Last,
                vec![Value::array(mc, vec![chosen]), Value::Null]
            )
            .strict_eq(chosen)
        );
        assert!(
            call_value(
                NativeGlobal::At,
                vec![Value::array(mc, vec![chosen]), Value::Number(0.0)]
            )
            .strict_eq(chosen)
        );
        assert!(call_value(NativeGlobal::Last, vec![Value::Null, chosen]).strict_eq(chosen));
        let symbol_name = Value::string(mc, "uffda-identity-test");
        let symbol_a = call_value(NativeGlobal::Symbol, vec![symbol_name]);
        let symbol_b = call_value(NativeGlobal::Symbol, vec![symbol_name]);
        assert!(symbol_a.strict_eq(symbol_b));
        assert!(matches!(
            call_value(
                NativeGlobal::Eq,
                vec![Value::Number(f64::NAN), Value::Number(f64::NAN)]
            ),
            Value::Boolean(false)
        ));
        assert!(matches!(
            call_value(
                NativeGlobal::Eq,
                vec![Value::Number(-0.0), Value::Number(0.0)]
            ),
            Value::Boolean(true)
        ));
        assert_eq!(
            text(call_value(
                NativeGlobal::Base58,
                vec![Value::Bytes(uffda_heap::Gc::new(mc, vec![0, 0]))]
            ))
            .unwrap(),
            "11"
        );

        let source = Value::string(mc, "abcdef").wrap_root(mc);
        let sliced = call_value(
            NativeGlobal::Slice,
            vec![source, Value::Number(2.0), Value::Number(4.0)],
        );
        assert_eq!(text(sliced).unwrap(), "cd");
        assert_eq!(sliced.char_origin(0), Some(Origin { start: 2, end: 3 }));
        assert_eq!(sliced.char_origin(1), Some(Origin { start: 3, end: 4 }));

        let selected = Value::object(mc, vec![]);
        let array = Value::array(mc, vec![Value::Null, selected, Value::Undefined]);
        let sliced_array = call_value(
            NativeGlobal::Slice,
            vec![array, Value::Number(1.0), Value::Number(2.0)],
        );
        let Value::Array(sliced_array) = sliced_array else {
            panic!("array slice must return an array");
        };
        assert!(sliced_array.borrow()[0].strict_eq(selected));
    });
}

#[test]
// req:expressions-runtime-004 req:expressions-runtime-007 req:runtime-memory-005
fn callable_object_coercion_hooks_resume_and_propagate_failures() {
    let object = json!({"kind":"object","keys":[{"kind":"objectKey","name":"toString","expression":{
        "kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":"42"}
    }}]});
    let object: Expression = serde_json::from_value(object.clone()).unwrap();
    let mut execution = Evaluation::new(call("int", vec![object]));
    assert!(matches!(
        execution.finish(),
        Err(EvaluationError::StringCoercion(_))
    ));
    let ast: Expression = serde_json::from_value(json!({
                "kind":"string","values":["result=",{"kind":"object","keys":[{"kind":"objectKey","name":"toString","expression":{
                    "kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":"42"}
                }}]}]
            })).unwrap();
    let mut execution = Evaluation::new(ast);
    assert!(matches!(
        execution.finish(),
        Err(EvaluationError::StringCoercion(_))
    ));
    let object: Expression = serde_json::from_value(json!({"kind":"object","keys":[
                {"kind":"objectKey","name":"toString","expression":{"kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":{}}}},
                {"kind":"objectKey","name":"valueOf","expression":{"kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"value","value":7}}}
            ]})).unwrap();
    let mut execution = Evaluation::new(call("format", vec![literal(json!("<{0}>")), object]));
    assert!(matches!(
        execution.finish(),
        Err(EvaluationError::StringCoercion(_))
    ));
    let object: Expression = serde_json::from_value(json!({"kind":"object","keys":[
                {"kind":"objectComputedKey","keyExpression":{"kind":"invocation","expression":{"kind":"reference","name":"symbol"},"args":[{"kind":"value","value":"toPrimitive"}]},
                "expression":{"kind":"reference","name":"id"}}
            ]})).unwrap();
    let mut execution = Evaluation::new(call("format", vec![literal(json!("{0}")), object]));
    assert!(matches!(
        execution.finish(),
        Err(EvaluationError::StringCoercion(_))
    ));
    let bad: Expression = serde_json::from_value(json!({"kind":"object","keys":[
                {"kind":"objectKey","name":"toString","expression":{"kind":"lambda","pattern":{"kind":"end"},"expression":{"kind":"reference","name":"missing"}}}
            ]})).unwrap();
    let mut evaluation = Evaluation::new(call("format", vec![literal(json!("{0}")), bad]));
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::StringCoercion(crate::coercion::StringCoercionError::CompositeConversion)
    );
}

#[test]
// req:expressions-runtime-004 req:expressions-runtime-007 req:runtime-memory-005
fn json_to_json_hooks_run_at_each_property_with_correct_key_arguments() {
    let hook = json!({"kind":"object","keys":[{"kind":"objectKey","name":"toJSON","expression":{"kind":"reference","name":"id"}}]});
    let ast: Expression = serde_json::from_value(json!({"kind":"object","keys":[
        {"kind":"objectKey","name":"name","expression":hook.clone()},
        {"kind":"objectKey","name":"items","expression":{"kind":"array","expressions":[
            {"kind":"arrayElement","expression":hook}
        ]}}
    ]}))
    .unwrap();
    assert_eq!(
        evaluate(call("json", vec![ast])),
        r#""{\"name\":\"name\",\"items\":[\"0\"]}""#
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-006 req:expressions-runtime-007
fn map_set_global_operations_preserve_identity_insertion_and_values_iteration() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let first = Value::object(mc, vec![("name".into(), Value::string(mc, "first"))]);
        let second = Value::object(mc, vec![("name".into(), Value::string(mc, "second"))]);
        let map = Value::map(
            mc,
            vec![
                (Value::string(mc, "b"), first),
                (Value::string(mc, "a"), second),
            ],
        );
        let NativeResult::Value(names) = invoke(
            mc,
            NativeGlobal::Pluck,
            vec![map, Value::string(mc, "name")],
            origin,
        )
        .unwrap() else {
            unreachable!()
        };
        assert_eq!(json_text(names).unwrap().unwrap(), r#"["first","second"]"#);
        let NativeResult::Value(found) = invoke(
            mc,
            NativeGlobal::Has,
            vec![map, Value::string(mc, "b")],
            origin,
        )
        .unwrap() else {
            unreachable!()
        };
        assert!(truthy(found));
        let left = source_item(mc, map, 0).unwrap();
        let right = source_item(mc, map, 0).unwrap();
        assert!(
            !left.strict_eq(right),
            "Map iteration creates fresh entry arrays"
        );
        let NativeResult::Value(set) = invoke(mc, NativeGlobal::ToSet, vec![map], origin).unwrap()
        else {
            unreachable!()
        };
        let Value::Set(set) = set else { unreachable!() };
        assert_eq!(set.borrow().len(), 2);
        assert!(
            !set.borrow()[0].strict_eq(first),
            "unwrap clones plain object members"
        );
    });
}
#[test]
// req:expressions-runtime-007 req:runtime-memory-005
fn json_and_flat_are_stack_safe_and_detect_cycles() {
    rootless_mutate(|mc| {
        let mut value = Value::Number(42.0);
        for _ in 0..10_000 {
            value = Value::array(mc, vec![value]);
        }
        assert_eq!(json_text(value).unwrap().unwrap().len(), 20_002);
        let cyclic = Value::array(mc, vec![]);
        let Value::Array(a) = cyclic else {
            unreachable!()
        };
        a.borrow_mut(mc).push(cyclic);
        assert!(json_text(cyclic).is_err());
        assert!(
            invoke(
                mc,
                NativeGlobal::Flat,
                vec![cyclic, Value::Number(f64::INFINITY)],
                Origin { start: 0, end: 0 }
            )
            .is_err()
        );
        assert_eq!(
            json_text(Value::array(
                mc,
                vec![Value::Undefined, Value::Number(f64::NAN)]
            ))
            .unwrap()
            .unwrap(),
            "[null,null]"
        );
    });
}

#[test]
// req:standard-library-002
fn gt_is_true_only_when_left_sorts_strictly_after_right() {
    assert_eq!(
        evaluate(call("gt", vec![literal(json!(2)), literal(json!(1))])),
        "true"
    );
    assert_eq!(
        evaluate(call("gt", vec![literal(json!(1)), literal(json!(2))])),
        "false"
    );
    assert_eq!(
        evaluate(call("gt", vec![literal(json!(2)), literal(json!(2))])),
        "false"
    );
    let metadata = metadata_of("gt").expect("gt metadata");
    assert_eq!(
        metadata
            .parameters
            .iter()
            .map(|parameter| parameter.name)
            .collect::<Vec<_>>(),
        ["left", "right"]
    );
}

#[test]
// req:standard-library-002
fn lt_is_true_only_when_left_sorts_strictly_before_right() {
    assert_eq!(
        evaluate(call("lt", vec![literal(json!(1)), literal(json!(2))])),
        "true"
    );
    assert_eq!(
        evaluate(call("lt", vec![literal(json!(2)), literal(json!(1))])),
        "false"
    );
    assert_eq!(
        evaluate(call("lt", vec![literal(json!(2)), literal(json!(2))])),
        "false"
    );
    let metadata = metadata_of("lt").expect("lt metadata");
    assert_eq!(
        metadata
            .parameters
            .iter()
            .map(|parameter| parameter.name)
            .collect::<Vec<_>>(),
        ["left", "right"]
    );
}

#[test]
// req:standard-library-002
fn gte_is_true_when_left_sorts_after_or_equal_to_right() {
    assert_eq!(
        evaluate(call("gte", vec![literal(json!(2)), literal(json!(1))])),
        "true"
    );
    assert_eq!(
        evaluate(call("gte", vec![literal(json!(2)), literal(json!(2))])),
        "true"
    );
    assert_eq!(
        evaluate(call("gte", vec![literal(json!(1)), literal(json!(2))])),
        "false"
    );
    let metadata = metadata_of("gte").expect("gte metadata");
    assert_eq!(
        metadata
            .parameters
            .iter()
            .map(|parameter| parameter.name)
            .collect::<Vec<_>>(),
        ["left", "right"]
    );
}

#[test]
// req:standard-library-002
fn lte_is_true_when_left_sorts_before_or_equal_to_right() {
    assert_eq!(
        evaluate(call("lte", vec![literal(json!(1)), literal(json!(2))])),
        "true"
    );
    assert_eq!(
        evaluate(call("lte", vec![literal(json!(2)), literal(json!(2))])),
        "true"
    );
    assert_eq!(
        evaluate(call("lte", vec![literal(json!(2)), literal(json!(1))])),
        "false"
    );
    let metadata = metadata_of("lte").expect("lte metadata");
    assert_eq!(
        metadata
            .parameters
            .iter()
            .map(|parameter| parameter.name)
            .collect::<Vec<_>>(),
        ["left", "right"]
    );
}

#[test]
// req:standard-library-002
fn not_negates_truthiness_of_raw_values() {
    assert_eq!(evaluate(call("not", vec![literal(json!(true))])), "false");
    assert_eq!(evaluate(call("not", vec![literal(json!(false))])), "true");
    assert_eq!(evaluate(call("not", vec![literal(json!(0))])), "true");
    assert_eq!(evaluate(call("not", vec![literal(json!("x"))])), "false");
    let metadata = metadata_of("not").expect("not metadata");
    assert_eq!(
        metadata
            .parameters
            .iter()
            .map(|parameter| parameter.name)
            .collect::<Vec<_>>(),
        ["value"]
    );
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let invoke_bool = |value| match invoke(mc, NativeGlobal::Not, vec![value], origin).unwrap()
        {
            NativeResult::Value(Value::Boolean(value)) => value,
            _ => panic!("expected boolean"),
        };
        assert!(invoke_bool(Value::Boolean(false).wrap(mc, origin)));
        assert!(invoke_bool(Value::Number(0.0).wrap(mc, origin)));
    });
}

fn parameter_names(global: &str) -> Vec<&'static str> {
    metadata_of(global)
        .unwrap_or_else(|| panic!("{global} metadata"))
        .parameters
        .iter()
        .map(|parameter| parameter.name)
        .collect()
}

#[test]
// req:standard-library-002
fn add_adds_numbers_rejects_non_numbers_and_reads_raw_operands() {
    assert_eq!(
        evaluate(call("add", vec![literal(json!(2)), literal(json!(3))])),
        "5"
    );
    assert_eq!(parameter_names("add"), ["left", "right"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        assert!(
            invoke(
                mc,
                NativeGlobal::Add,
                vec![Value::string(mc, "2"), Value::Number(3.0)],
                origin,
            )
            .is_err()
        );
        let sum = match invoke(
            mc,
            NativeGlobal::Add,
            vec![
                Value::Number(7.0).wrap(mc, origin),
                Value::Number(11.0).wrap(mc, Origin { start: 1, end: 2 }),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Number(sum)) => sum,
            _ => panic!("expected number"),
        };
        assert_eq!(sum, 18.0);
    });
}

#[test]
// req:standard-library-002
fn sub_subtracts_numbers_rejects_non_numbers_and_reads_raw_operands() {
    assert_eq!(
        evaluate(call("sub", vec![literal(json!(5)), literal(json!(2))])),
        "3"
    );
    assert_eq!(
        evaluate(call("sub", vec![literal(json!(2)), literal(json!(5))])),
        "-3"
    );
    assert_eq!(parameter_names("sub"), ["left", "right"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        assert!(
            invoke(
                mc,
                NativeGlobal::Sub,
                vec![Value::string(mc, "5"), Value::Number(2.0)],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Sub,
                vec![Value::Number(5.0), Value::string(mc, "2")],
                origin,
            )
            .is_err()
        );
        let difference = match invoke(
            mc,
            NativeGlobal::Sub,
            vec![
                Value::Number(11.0).wrap(mc, origin),
                Value::Number(7.0).wrap(mc, Origin { start: 1, end: 2 }),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Number(difference)) => difference,
            _ => panic!("expected number"),
        };
        assert_eq!(difference, 4.0);
    });
}

#[test]
// req:standard-library-002
fn compare_orders_numbers_and_strings_and_rejects_mixed_types() {
    assert_eq!(
        evaluate(call("compare", vec![literal(json!(1)), literal(json!(2))])),
        "-1"
    );
    assert_eq!(
        evaluate(call("compare", vec![literal(json!(2)), literal(json!(1))])),
        "1"
    );
    assert_eq!(
        evaluate(call("compare", vec![literal(json!(2)), literal(json!(2))])),
        "0"
    );
    assert_eq!(
        evaluate(call(
            "compare",
            vec![literal(json!("a")), literal(json!("b"))]
        )),
        "-1"
    );
    assert_eq!(
        evaluate(call(
            "compare",
            vec![literal(json!("b")), literal(json!("a"))]
        )),
        "1"
    );
    assert_eq!(
        evaluate(call(
            "compare",
            vec![literal(json!("a")), literal(json!("a"))]
        )),
        "0"
    );
    assert_eq!(parameter_names("compare"), ["left", "right"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        assert!(
            invoke(
                mc,
                NativeGlobal::Compare,
                vec![Value::Number(1.0), Value::string(mc, "1")],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Compare,
                vec![Value::Null, Value::Number(1.0)],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Compare,
                vec![Value::object(mc, vec![]), Value::object(mc, vec![])],
                origin,
            )
            .is_err()
        );
        let order = match invoke(
            mc,
            NativeGlobal::Compare,
            vec![
                Value::string(mc, "a").wrap(mc, origin),
                Value::string(mc, "b").wrap(mc, Origin { start: 1, end: 2 }),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Number(order)) => order,
            _ => panic!("expected number"),
        };
        assert_eq!(order, -1.0);
    });
}

#[test]
// req:standard-library-002
fn pack_collects_arguments_and_preserves_undefined_and_aggregates() {
    assert_eq!(
        evaluate(call(
            "pack",
            vec![literal(json!(1)), literal(json!("a")), literal(json!(true))]
        )),
        r#"[1,"a",true]"#
    );
    assert_eq!(parameter_names("pack"), ["values"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let aggregate = Value::object(mc, vec![("value".into(), Value::Number(42.0))]);
        let NativeResult::Value(Value::Array(values)) = invoke(
            mc,
            NativeGlobal::Pack,
            vec![Value::Undefined, aggregate],
            origin,
        )
        .unwrap() else {
            panic!("pack must return an array");
        };
        let values = values.borrow();
        assert!(values[0].strict_eq(Value::Undefined));
        assert!(values[1].strict_eq(aggregate));
    });
}

#[test]
// req:standard-library-002
fn one_returns_the_sole_element_or_the_full_value() {
    assert_eq!(parameter_names("one"), ["items", "full"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let call_one =
            |items, full| match invoke(mc, NativeGlobal::One, vec![items, full], origin).unwrap() {
                NativeResult::Value(value) => value,
                _ => panic!("expected value"),
            };
        let sole = Value::object(mc, vec![("kind".into(), Value::string(mc, "any"))]);
        assert!(call_one(Value::array(mc, vec![sole]), Value::Null).strict_eq(sole));
        let full = Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]);
        assert!(call_one(full, full).strict_eq(full));
        let empty_full = Value::object(mc, vec![]);
        assert!(call_one(Value::array(mc, vec![]), empty_full).strict_eq(empty_full));
        let item = Value::Number(1.0).wrap(mc, origin);
        let wrapped_items = Value::array(mc, vec![item]).wrap(mc, origin);
        assert!(call_one(wrapped_items, Value::Undefined).strict_eq(item));
    });
}

#[test]
// req:standard-library-002
fn last_returns_the_final_element_or_the_fallback() {
    assert_eq!(
        evaluate(call(
            "last",
            vec![literal(json!(["a", "b", "c"])), literal(json!(null))]
        )),
        "\"c\""
    );
    assert_eq!(
        evaluate(call(
            "last",
            vec![literal(json!([])), literal(json!("fallback"))]
        )),
        "\"fallback\""
    );
    assert_eq!(
        evaluate(call(
            "last",
            vec![literal(json!("ab")), literal(json!(null))]
        )),
        "\"b\""
    );
    assert_eq!(
        evaluate(call(
            "last",
            vec![literal(json!("")), literal(json!("fallback"))]
        )),
        "\"fallback\""
    );
    assert_eq!(parameter_names("last"), ["self", "fallback"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let fallback = Value::string(mc, "fallback");
        let call_last =
            |value| match invoke(mc, NativeGlobal::Last, vec![value, fallback], origin).unwrap() {
                NativeResult::Value(value) => value,
                _ => panic!("expected value"),
            };
        for value in [
            Value::Null,
            Value::Undefined,
            Value::Number(42.0),
            Value::object(mc, vec![]),
            Value::set(mc, vec![Value::Number(1.0)]),
        ] {
            assert!(call_last(value).strict_eq(fallback));
        }
        let item = Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 });
        let items = Value::array(mc, vec![Value::Number(1.0).wrap(mc, origin), item])
            .wrap(mc, Origin { start: 0, end: 2 });
        match invoke(
            mc,
            NativeGlobal::Last,
            vec![items, Value::Undefined],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => assert!(value.strict_eq(item)),
            _ => panic!("expected value"),
        }
    });
}

#[test]
// req:standard-library-002
fn coalesce_returns_the_first_non_nullish_raw_value() {
    assert_eq!(
        evaluate(call(
            "coalesce",
            vec![
                literal(json!(null)),
                literal(json!(null)),
                literal(json!(0)),
                literal(json!(1))
            ]
        )),
        "0"
    );
    assert_eq!(parameter_names("coalesce"), ["values"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        match invoke(
            mc,
            NativeGlobal::Coalesce,
            vec![
                Value::Undefined,
                Value::Null,
                Value::Number(0.0),
                Value::Number(1.0),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Number(value)) => assert_eq!(value, 0.0),
            _ => panic!("expected zero"),
        }
        match invoke(
            mc,
            NativeGlobal::Coalesce,
            vec![Value::Undefined, Value::Null],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Undefined) => {}
            _ => panic!("expected undefined"),
        }
        let chosen = Value::Number(0.0).wrap(mc, Origin { start: 1, end: 2 });
        match invoke(
            mc,
            NativeGlobal::Coalesce,
            vec![Value::Undefined.wrap(mc, origin), chosen],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => assert!(value.strict_eq(chosen)),
            _ => panic!("expected value"),
        }
    });
}

#[test]
// req:runtime-core-012 req:standard-library-002
fn int_parses_digit_strings_and_rejects_composites() {
    assert_eq!(evaluate(call("int", vec![literal(json!("42"))])), "42");
    assert_eq!(evaluate(call("int", vec![literal(json!("123"))])), "123");
    assert_eq!(parameter_names("int"), ["value"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        for value in [
            Value::object(mc, vec![]),
            Value::array(mc, vec![Value::string(mc, "42")]),
            Value::Native(NativeGlobal::Id),
        ] {
            assert!(invoke(mc, NativeGlobal::Int, vec![value], origin).is_err());
        }
        match invoke(
            mc,
            NativeGlobal::Int,
            vec![Value::string(mc, "42").wrap(mc, Origin { start: 0, end: 2 })],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Number(value)) => assert_eq!(value, 42.0),
            _ => panic!("expected number"),
        }
    });
}

#[test]
// req:standard-library-002
fn base58_encodes_bytes_and_rejects_non_bytes() {
    assert_eq!(parameter_names("base58"), ["bytes"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let encode = |bytes| match invoke(mc, NativeGlobal::Base58, vec![bytes], origin).unwrap() {
            NativeResult::Value(value) => text(value).unwrap(),
            _ => panic!("expected text"),
        };
        let hello = Value::Bytes(uffda_heap::Gc::new(mc, b"Hello World!".to_vec()));
        assert_eq!(encode(hello), "2NEpo7TZRRrLZSi2U");
        assert_eq!(
            encode(Value::Bytes(uffda_heap::Gc::new(mc, vec![0, 0]))),
            "11"
        );
        assert_eq!(encode(hello.wrap(mc, origin)), encode(hello));
        assert!(
            invoke(
                mc,
                NativeGlobal::Base58,
                vec![Value::string(mc, "abc")],
                origin
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Base58,
                vec![Value::array(mc, vec![Value::Number(1.0)])],
                origin,
            )
            .is_err()
        );
    });
}

#[test]
// req:standard-library-002
fn has_checks_membership_with_same_value_zero() {
    assert_eq!(parameter_names("has"), ["collection", "value"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let found = |collection, value| match invoke(
            mc,
            NativeGlobal::Has,
            vec![collection, value],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(Value::Boolean(found)) => found,
            _ => panic!("expected boolean"),
        };
        let set = Value::set(mc, vec![Value::string(mc, "a"), Value::string(mc, "b")]);
        assert!(found(set, Value::string(mc, "a")));
        assert!(!found(
            Value::set(mc, vec![Value::string(mc, "a")]),
            Value::string(mc, "z")
        ));
        assert!(found(
            Value::array(mc, vec![Value::string(mc, "x"), Value::string(mc, "y")]),
            Value::string(mc, "y")
        ));
        let object = Value::object(mc, vec![("name".into(), Value::Number(1.0))]);
        assert!(found(object, Value::string(mc, "name")));
        assert!(!found(object, Value::string(mc, "other")));
        assert!(!found(Value::Null, Value::string(mc, "x")));
        let items = Value::array(
            mc,
            vec![
                Value::Number(1.0).wrap(mc, origin),
                Value::Number(f64::NAN).wrap(mc, Origin { start: 1, end: 2 }),
            ],
        )
        .wrap(mc, Origin { start: 0, end: 2 });
        assert!(found(
            items,
            Value::Number(1.0).wrap(mc, Origin { start: 5, end: 6 })
        ));
        assert!(found(items, Value::Number(f64::NAN)));
        assert!(!found(items, Value::Number(2.0)));
    });
}

#[test]
// req:standard-library-002
fn when_selects_by_truthiness_and_returns_the_branch() {
    assert_eq!(
        evaluate(call(
            "when",
            vec![
                literal(json!(true)),
                literal(json!("a")),
                literal(json!("b"))
            ]
        )),
        "\"a\""
    );
    assert_eq!(
        evaluate(call(
            "when",
            vec![
                literal(json!(false)),
                literal(json!("a")),
                literal(json!("b"))
            ]
        )),
        "\"b\""
    );
    assert_eq!(
        evaluate(call(
            "when",
            vec![literal(json!(0)), literal(json!("a")), literal(json!("b"))]
        )),
        "\"b\""
    );
    assert_eq!(
        evaluate(call(
            "when",
            vec![literal(json!("x")), literal(json!(1)), literal(json!(2))]
        )),
        "1"
    );
    assert_eq!(
        parameter_names("when"),
        ["condition", "thenValue", "elseValue"]
    );
    rootless_mutate(|mc| {
        let yes = Value::string(mc, "yes").wrap(mc, Origin { start: 1, end: 2 });
        match invoke(
            mc,
            NativeGlobal::When,
            vec![
                Value::Boolean(false).wrap(mc, Origin { start: 0, end: 0 }),
                Value::string(mc, "no").wrap(mc, Origin { start: 2, end: 3 }),
                yes,
            ],
            Origin { start: 0, end: 0 },
        )
        .unwrap()
        {
            NativeResult::Value(value) => assert!(value.strict_eq(yes)),
            _ => panic!("expected value"),
        }
    });
}

#[test]
// req:standard-library-002
fn flat_flattens_by_depth_and_carries_wrapped_elements() {
    assert_eq!(
        evaluate(call("flat", vec![literal(json!(["a", ["b", "c"]]))])),
        r#"["a","b","c"]"#
    );
    assert_eq!(
        evaluate(call(
            "flat",
            vec![literal(json!(["a", ["b", ["c"]]])), literal(json!(2))]
        )),
        r#"["a","b","c"]"#
    );
    assert_eq!(parameter_names("flat"), ["self", "depth"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let a = Value::Number(1.0).wrap(mc, origin);
        let b = Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 });
        let nested = Value::array(
            mc,
            vec![
                a,
                Value::array(mc, vec![b]).wrap(mc, Origin { start: 1, end: 2 }),
            ],
        )
        .wrap(mc, Origin { start: 0, end: 2 });
        let NativeResult::Value(Value::Array(flattened)) =
            invoke(mc, NativeGlobal::Flat, vec![nested], origin).unwrap()
        else {
            panic!("flat must return an array");
        };
        let flattened = flattened.borrow();
        assert!(flattened[0].strict_eq(a));
        assert!(flattened[1].strict_eq(b));
    });
}

#[test]
// req:runtime-memory-001 req:standard-library-002
fn id_returns_the_same_reference() {
    assert_eq!(parameter_names("id"), ["value"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let inputs = [
            Value::array(mc, vec![Value::Number(1.0)]),
            Value::object(mc, vec![("value".into(), Value::Number(1.0))]),
            Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))]),
            Value::set(mc, vec![Value::Number(1.0)]),
            Value::Bytes(uffda_heap::Gc::new(mc, vec![1])),
            Value::date(mc, time::OffsetDateTime::UNIX_EPOCH),
            Value::error(mc, "Error".into(), "failure".into(), None, None),
            Value::bigint(mc, num_bigint::BigInt::from(1)),
            Value::Symbol(uffda_heap::Gc::new(mc, "uffda-id-reference".into())),
            Value::Undefined,
            Value::object(mc, vec![("value".into(), Value::Number(1.0))]).wrap(mc, origin),
        ];
        for input in inputs {
            match invoke(mc, NativeGlobal::Id, vec![input], origin).unwrap() {
                NativeResult::Value(value) => assert!(value.strict_eq(input)),
                _ => panic!("expected value"),
            }
        }
    });
}

#[test]
// req:runtime-core-012 req:standard-library-002
fn json_serializes_raw_values() {
    assert_eq!(
        evaluate(call("json", vec![literal(json!({"a":[1]}))])),
        r#""{\"a\":[1]}""#
    );
    assert_eq!(parameter_names("json"), ["self"]);
    rootless_mutate(|mc| {
        let wrapped = Value::array(
            mc,
            vec![Value::Number(1.0).wrap(mc, Origin { start: 0, end: 0 })],
        )
        .wrap(mc, Origin { start: 0, end: 0 });
        assert_eq!(json_text(wrapped).unwrap().as_deref(), Some("[1]"));
    });
}

#[test]
// req:runtime-memory-001 req:standard-library-002
fn eq_uses_strict_equality_on_raw_values() {
    assert_eq!(
        evaluate(call("eq", vec![literal(json!(1)), literal(json!(1))])),
        "true"
    );
    assert_eq!(
        evaluate(call("eq", vec![literal(json!(1)), literal(json!("1"))])),
        "false"
    );
    assert_eq!(parameter_names("eq"), ["left", "right"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let equal =
            |left, right| match invoke(mc, NativeGlobal::Eq, vec![left, right], origin).unwrap() {
                NativeResult::Value(Value::Boolean(value)) => value,
                _ => panic!("expected boolean"),
            };
        assert!(!equal(Value::Null, Value::Undefined));
        assert!(equal(
            Value::Number(1.0).wrap(mc, origin),
            Value::Number(1.0).wrap(mc, Origin { start: 5, end: 6 })
        ));
        assert!(!equal(
            Value::Number(1.0).wrap(mc, origin),
            Value::Number(2.0)
        ));
        let array = Value::array(mc, vec![Value::Number(1.0)]);
        let object = Value::object(mc, vec![("value".into(), Value::Number(1.0))]);
        let map = Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))]);
        let set = Value::set(mc, vec![Value::Number(1.0)]);
        for value in [array, object, map, set] {
            assert!(equal(value, value));
        }
        assert!(!equal(
            Value::array(mc, vec![Value::Number(1.0)]),
            Value::array(mc, vec![Value::Number(1.0)])
        ));
        assert!(!equal(
            Value::object(mc, vec![("value".into(), Value::Number(1.0))]),
            Value::object(mc, vec![("value".into(), Value::Number(1.0))])
        ));
        assert!(!equal(
            Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))]),
            Value::map(mc, vec![(Value::string(mc, "value"), Value::Number(1.0))])
        ));
        assert!(!equal(
            Value::set(mc, vec![Value::Number(1.0)]),
            Value::set(mc, vec![Value::Number(1.0)])
        ));
    });
}

#[test]
// req:standard-library-002
fn length_counts_strings_arrays_sets_and_maps() {
    assert_eq!(evaluate(call("length", vec![literal(json!("abc"))])), "3");
    assert_eq!(evaluate(call("length", vec![literal(json!(""))])), "0");
    assert_eq!(
        evaluate(call("length", vec![literal(json!([1, 2, 3]))])),
        "3"
    );
    assert_eq!(evaluate(call("length", vec![literal(json!([]))])), "0");
    assert_eq!(parameter_names("length"), ["value"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let count = |value| match invoke(mc, NativeGlobal::Length, vec![value], origin).unwrap() {
            NativeResult::Value(Value::Number(value)) => value,
            _ => panic!("expected number"),
        };
        assert_eq!(
            count(Value::set(
                mc,
                vec![Value::Number(1.0), Value::Number(2.0), Value::Number(3.0)]
            )),
            3.0
        );
        assert_eq!(
            count(Value::map(
                mc,
                vec![
                    (Value::string(mc, "a"), Value::Number(1.0)),
                    (Value::string(mc, "b"), Value::Number(2.0)),
                ]
            )),
            2.0
        );
        for value in [Value::Number(42.0), Value::Null, Value::object(mc, vec![])] {
            assert!(invoke(mc, NativeGlobal::Length, vec![value], origin).is_err());
        }
        assert_eq!(
            count(Value::string(mc, "abc").wrap(mc, Origin { start: 0, end: 3 })),
            3.0
        );
        assert_eq!(
            count(Value::array(mc, vec![Value::Number(1.0).wrap(mc, origin)]).wrap(mc, origin)),
            1.0
        );
    });
}

#[test]
// req:standard-library-002
fn sha256_hashes_raw_text_and_rejects_non_strings() {
    assert_eq!(parameter_names("sha256"), ["text"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let digest = |value| match invoke(mc, NativeGlobal::Sha256, vec![value], origin).unwrap() {
            NativeResult::Value(Value::Bytes(bytes)) => bytes,
            _ => panic!("expected bytes"),
        };
        let hello = digest(Value::string(mc, "hello"));
        assert_eq!(hello, digest(Value::string(mc, "hello")));
        assert_eq!(
            hello.as_slice(),
            &[
                0x2c, 0xf2, 0x4d, 0xba, 0x5f, 0xb0, 0xa3, 0x0e, 0x26, 0xe8, 0x3b, 0x2a, 0xc5, 0xb9,
                0xe2, 0x9e, 0x1b, 0x16, 0x1e, 0x5c, 0x1f, 0xa7, 0x42, 0x5e, 0x73, 0x04, 0x33, 0x62,
                0x93, 0x8b, 0x98, 0x24,
            ]
        );
        assert!(invoke(mc, NativeGlobal::Sha256, vec![Value::Number(1.0)], origin).is_err());
        assert_eq!(
            digest(Value::string(mc, "abc").wrap(mc, origin)).as_slice(),
            digest(Value::string(mc, "abc")).as_slice()
        );
    });
}

#[test]
// req:runtime-core-012 req:standard-library-002
fn join_formats_scalars_and_keeps_character_provenance() {
    assert_eq!(
        evaluate(call(
            "join",
            vec![literal(json!(["a", "b"])), literal(json!("-"))]
        )),
        "\"a-b\""
    );
    assert_eq!(
        evaluate(call("join", vec![literal(json!(["a", "b"]))])),
        "\"a,b\""
    );
    assert_eq!(
        evaluate(call(
            "join",
            vec![literal(json!([1, null, true])), literal(json!("-"))]
        )),
        "\"1--true\""
    );
    assert_eq!(parameter_names("join"), ["self", "separator"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        for value in [
            Value::object(mc, vec![]),
            Value::array(mc, vec![]),
            Value::Native(NativeGlobal::Id),
        ] {
            assert!(
                invoke(
                    mc,
                    NativeGlobal::Join,
                    vec![Value::array(mc, vec![value])],
                    origin,
                )
                .is_err()
            );
            assert!(
                invoke(
                    mc,
                    NativeGlobal::Join,
                    vec![Value::array(mc, vec![value]).wrap(mc, origin),],
                    origin,
                )
                .is_err()
            );
            assert!(
                invoke(
                    mc,
                    NativeGlobal::Join,
                    vec![
                        Value::array(mc, vec![Value::string(mc, "a"), Value::string(mc, "b")]),
                        value,
                    ],
                    origin,
                )
                .is_err()
            );
        }
        let items = Value::array(
            mc,
            vec![
                Value::string(mc, "a").wrap(mc, Origin { start: 2, end: 3 }),
                Value::string(mc, "b").wrap(mc, Origin { start: 8, end: 9 }),
            ],
        )
        .wrap(mc, Origin { start: 0, end: 9 });
        let joined = match invoke(
            mc,
            NativeGlobal::Join,
            vec![items, Value::string(mc, "-")],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            _ => panic!("expected value"),
        };
        assert_eq!(text(joined).unwrap(), "a-b");
        assert_eq!(joined.char_origin(0), Some(Origin { start: 2, end: 3 }));
        assert_eq!(joined.char_origin(2), Some(Origin { start: 8, end: 9 }));
        let defaults = match invoke(mc, NativeGlobal::Join, vec![items], origin).unwrap() {
            NativeResult::Value(value) => value,
            _ => panic!("expected value"),
        };
        assert_eq!(text(defaults).unwrap(), "a,b");
    });
}

#[test]
// req:standard-library-002
fn to_set_deduplicates_collection_values_with_same_value_zero() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let value = |args| match invoke(mc, NativeGlobal::ToSet, args, origin).unwrap() {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let texts = |set: Value| {
            let Value::Set(items) = set else {
                panic!("expected set")
            };
            items
                .borrow()
                .iter()
                .map(|item| text(*item).unwrap())
                .collect::<Vec<_>>()
        };
        assert_eq!(
            texts(value(vec![Value::array(
                mc,
                vec![
                    Value::string(mc, "a"),
                    Value::string(mc, "b"),
                    Value::string(mc, "a"),
                ],
            )])),
            ["a", "b"]
        );
        assert_eq!(
            texts(value(vec![Value::object(
                mc,
                vec![
                    ("x".into(), Value::string(mc, "a")),
                    ("y".into(), Value::string(mc, "b")),
                ],
            )])),
            ["a", "b"]
        );
        assert_eq!(
            texts(value(vec![Value::map(
                mc,
                vec![
                    (Value::string(mc, "k"), Value::string(mc, "a")),
                    (Value::string(mc, "m"), Value::string(mc, "b")),
                ],
            )])),
            ["a", "b"]
        );
        assert_eq!(
            texts(value(vec![Value::set(
                mc,
                vec![
                    Value::string(mc, "a"),
                    Value::string(mc, "a"),
                    Value::string(mc, "b"),
                ],
            )])),
            ["a", "b"]
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::ToSet,
                vec![Value::string(mc, "a")],
                origin,
            )
            .is_err()
        );
        assert_eq!(parameter_names("to_set"), ["items"]);
        let members = value(vec![
            Value::array(
                mc,
                vec![
                    Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 }),
                    Value::Number(1.0).wrap(mc, Origin { start: 1, end: 2 }),
                ],
            )
            .wrap(mc, Origin { start: 0, end: 2 }),
        ]);
        assert_eq!(length(members).unwrap(), 1);
        assert!(truthy(
            match invoke(
                mc,
                NativeGlobal::Has,
                vec![members, Value::Number(1.0)],
                origin,
            )
            .unwrap()
            {
                NativeResult::Value(value) => value,
                NativeResult::Reduce { .. } => panic!("expected value"),
            }
        ));
    });
}

#[test]
// req:runtime-memory-001 req:standard-library-002
fn symbol_returns_stable_identity_for_repeated_names() {
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let symbol = |name| match invoke(mc, NativeGlobal::Symbol, vec![name], origin).unwrap() {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let iterator = symbol(Value::string(mc, "iterator"));
        let again = symbol(Value::string(mc, "iterator"));
        assert_eq!(iterator.runtime_type(), RuntimeType::Symbol);
        assert!(iterator.strict_eq(again));
        assert!(iterator.strict_eq(symbol(Value::string(mc, "iterator"))));
        assert!(!iterator.strict_eq(Value::string(mc, "iterator")));
        let registered = symbol(Value::string(mc, "uffda-identity-test"));
        assert!(registered.strict_eq(symbol(Value::string(mc, "uffda-identity-test"))));
        let custom = symbol(Value::string(mc, "iterator-but-not-really"));
        assert_eq!(custom.runtime_type(), RuntimeType::Symbol);
        assert!(!custom.strict_eq(iterator));
        assert!(
            symbol(Value::string(mc, "asyncIterator").wrap(mc, Origin { start: 0, end: 13 }))
                .strict_eq(symbol(Value::string(mc, "asyncIterator")))
        );
        assert_eq!(parameter_names("symbol"), ["name"]);
    });
}

#[test]
// req:runtime-core-012 req:standard-library-002
fn format_substitutes_placeholders_and_keeps_character_provenance() {
    assert_eq!(
        evaluate(call(
            "format",
            vec![
                literal(json!("{0}-{1}-{2}")),
                literal(json!("a")),
                literal(json!(1)),
            ],
        )),
        r#""a-1-{2}""#
    );
    assert_eq!(parameter_names("format"), ["value", "args"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let native = Value::Native(NativeGlobal::Id);
        for template in [
            Value::string(mc, "{0}"),
            Value::string(mc, "{0}").wrap(mc, origin),
        ] {
            for argument in [
                native,
                Value::array(mc, vec![native]),
                Value::object(mc, vec![]),
                Value::array(mc, vec![]),
            ] {
                assert!(
                    invoke(mc, NativeGlobal::Format, vec![template, argument], origin,).is_err()
                );
            }
        }
        let template_origin = Origin { start: 10, end: 17 };
        let template = Value::Located(uffda_heap::Gc::new(
            mc,
            crate::provenance::Located {
                raw: Value::string(mc, "<{0}>{1}"),
                origin: template_origin,
                chars: vec![crate::provenance::CharRun {
                    length: 8,
                    origin: template_origin,
                    linear: false,
                }],
            },
        ));
        let name = Value::Located(uffda_heap::Gc::new(
            mc,
            crate::provenance::Located {
                raw: Value::string(mc, "ab"),
                origin: Origin { start: 3, end: 5 },
                chars: vec![crate::provenance::CharRun {
                    length: 2,
                    origin: Origin { start: 3, end: 5 },
                    linear: true,
                }],
            },
        ));
        let result = match invoke(
            mc,
            NativeGlobal::Format,
            vec![template, name, Value::Number(7.0)],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(text(result).unwrap(), "<ab>7");
        assert_eq!(result.origin(), Some(template_origin));
        assert_eq!(result.char_origin(0), Some(template_origin));
        assert_eq!(result.char_origin(1), Some(Origin { start: 3, end: 4 }));
        assert_eq!(result.char_origin(2), Some(Origin { start: 4, end: 5 }));
        assert_eq!(result.char_origin(3), Some(template_origin));
        assert_eq!(result.char_origin(4), Some(template_origin));
        let wrapped = match invoke(
            mc,
            NativeGlobal::Format,
            vec![
                Value::string(mc, "{0}-{1}-{2}").wrap(mc, origin),
                Value::Number(1.0).wrap(mc, Origin { start: 1, end: 2 }),
                Value::string(mc, "b"),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(text(wrapped).unwrap(), "1-b-{2}");
    });
}

#[test]
// req:standard-library-002
fn at_indexes_collections_and_carries_wrapped_elements() {
    assert_eq!(
        evaluate(call(
            "at",
            vec![literal(json!([1, 2, 3])), literal(json!(1))],
        )),
        "2"
    );
    assert_eq!(
        evaluate(call("at", vec![literal(json!("abc")), literal(json!(0))],)),
        r#""a""#
    );
    assert_eq!(
        evaluate(call("at", vec![literal(json!("abc")), literal(json!(2))],)),
        r#""c""#
    );
    assert_eq!(parameter_names("at"), ["value", "index"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let at = |value, index| match invoke(mc, NativeGlobal::At, vec![value, index], origin)
            .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert!(matches!(
            at(
                Value::array(
                    mc,
                    vec![Value::Number(1.0), Value::Number(2.0), Value::Number(3.0)]
                ),
                Value::Number(5.0)
            ),
            Value::Undefined
        ));
        let set = Value::set(
            mc,
            vec![
                Value::string(mc, "a"),
                Value::string(mc, "b"),
                Value::string(mc, "c"),
            ],
        );
        assert_eq!(text(at(set, Value::Number(0.0))).unwrap(), "a");
        assert_eq!(text(at(set, Value::Number(2.0))).unwrap(), "c");
        assert!(matches!(at(set, Value::Number(5.0)), Value::Undefined));
        let map = Value::map(
            mc,
            vec![
                (Value::string(mc, "a"), Value::Number(1.0)),
                (Value::string(mc, "b"), Value::Number(2.0)),
            ],
        );
        assert_eq!(
            json_text(at(map, Value::Number(0.0))).unwrap().unwrap(),
            r#"["a",1]"#
        );
        assert_eq!(
            json_text(at(map, Value::Number(1.0))).unwrap().unwrap(),
            r#"["b",2]"#
        );
        assert!(matches!(at(map, Value::Number(5.0)), Value::Undefined));
        assert!(
            invoke(
                mc,
                NativeGlobal::At,
                vec![Value::object(mc, vec![]), Value::Number(0.0)],
                origin
            )
            .is_err()
        );
        let item = Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 });
        let items = Value::array(mc, vec![Value::Number(1.0).wrap(mc, origin), item])
            .wrap(mc, Origin { start: 0, end: 2 });
        assert!(
            at(
                items,
                Value::Number(1.0).wrap(mc, Origin { start: 9, end: 10 })
            )
            .same_wrapper(item)
        );
        let joined = crate::provenance::concatenate(
            mc,
            &[
                Value::string(mc, "a").wrap(mc, Origin { start: 3, end: 4 }),
                Value::string(mc, "b").wrap(mc, Origin { start: 7, end: 8 }),
            ],
            origin,
        )
        .unwrap();
        let char = at(joined, Value::Number(1.0));
        assert_eq!(text(char).unwrap(), "b");
        assert_eq!(char.char_origin(0), Some(Origin { start: 7, end: 8 }));
    });
}

#[test]
// req:standard-library-002
fn from_entries_builds_objects_and_carries_wrapped_values() {
    assert_eq!(
        evaluate(call(
            "from_entries",
            vec![literal(json!([["a", 1], ["b", 2]]))],
        )),
        r#"{"a":1,"b":2}"#
    );
    assert_eq!(
        evaluate(call(
            "from_entries",
            vec![literal(json!([
                {"name": "name", "pattern": {"kind": "any"}},
                {"name": "enabled", "pattern": {"kind": "end"}}
            ]))],
        )),
        r#"{"name":{"kind":"any"},"enabled":{"kind":"end"}}"#
    );
    assert_eq!(
        evaluate(call(
            "from_entries",
            vec![literal(json!([{"name": "x", "value": 7}]))],
        )),
        r#"{"x":7}"#
    );
    assert_eq!(
        evaluate(call("from_entries", vec![literal(json!([]))])),
        "{}"
    );
    assert_eq!(parameter_names("from_entries"), ["entries"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        assert!(
            invoke(
                mc,
                NativeGlobal::FromEntries,
                vec![Value::object(mc, vec![])],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::FromEntries,
                vec![Value::array(mc, vec![Value::Number(1.0)])],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::FromEntries,
                vec![Value::array(
                    mc,
                    vec![Value::array(mc, vec![Value::string(mc, "only-key")])],
                )],
                origin,
            )
            .is_err()
        );
        let value = Value::Number(1.0).wrap(mc, Origin { start: 2, end: 3 });
        let entry = Value::array(
            mc,
            vec![
                Value::string(mc, "a").wrap(mc, Origin { start: 0, end: 1 }),
                value,
            ],
        )
        .wrap(mc, Origin { start: 0, end: 3 });
        let record = match invoke(
            mc,
            NativeGlobal::FromEntries,
            vec![Value::array(mc, vec![entry]).wrap(mc, Origin { start: 0, end: 3 })],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Object(object) = record else {
            panic!("expected object")
        };
        assert!(object.borrow().get("a").unwrap().same_wrapper(value));
    });
}

#[test]
// req:standard-library-002
fn pluck_maps_a_property_and_carries_wrapped_values() {
    assert_eq!(
        evaluate(call(
            "pluck",
            vec![
                literal(json!([{"name": "A"}, {"name": "B"}])),
                literal(json!("name")),
            ],
        )),
        r#"["A","B"]"#
    );
    assert_eq!(
        evaluate(call(
            "pluck",
            vec![literal(json!([{"names": ["x"]}])), literal(json!("names")),],
        )),
        r#"[["x"]]"#
    );
    assert_eq!(
        evaluate(call(
            "pluck",
            vec![
                literal(json!({"first": {"name": "A"}, "second": {"name": "B"}})),
                literal(json!("name")),
            ],
        )),
        r#"["A","B"]"#
    );
    assert_eq!(parameter_names("pluck"), ["collection", "key"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let map = Value::map(
            mc,
            vec![
                (
                    Value::string(mc, "a"),
                    Value::object(mc, vec![("name".into(), Value::string(mc, "A"))]),
                ),
                (
                    Value::string(mc, "b"),
                    Value::object(mc, vec![("name".into(), Value::string(mc, "B"))]),
                ),
            ],
        );
        let names = match invoke(
            mc,
            NativeGlobal::Pluck,
            vec![map, Value::string(mc, "name")],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(json_text(names).unwrap().unwrap(), r#"["A","B"]"#);
        let set = Value::set(
            mc,
            vec![
                Value::object(mc, vec![("name".into(), Value::string(mc, "A"))]),
                Value::object(mc, vec![("name".into(), Value::string(mc, "B"))]),
            ],
        );
        let names = match invoke(
            mc,
            NativeGlobal::Pluck,
            vec![set, Value::string(mc, "name")],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(json_text(names).unwrap().unwrap(), r#"["A","B"]"#);
        assert!(
            invoke(
                mc,
                NativeGlobal::Pluck,
                vec![Value::string(mc, "name"), Value::string(mc, "length")],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Pluck,
                vec![Value::Null, Value::string(mc, "name")],
                origin,
            )
            .is_err()
        );
        let name = Value::string(mc, "a").wrap(mc, Origin { start: 1, end: 2 });
        let element =
            Value::object(mc, vec![("name".into(), name)]).wrap(mc, Origin { start: 0, end: 3 });
        let plucked = match invoke(
            mc,
            NativeGlobal::Pluck,
            vec![
                Value::array(mc, vec![element]).wrap(mc, Origin { start: 0, end: 3 }),
                Value::string(mc, "name"),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Array(items) = plucked else {
            panic!("expected array")
        };
        assert!(items.borrow()[0].same_wrapper(name));
    });
}

#[test]
// req:standard-library-002
fn filter_keeps_truthy_elements_lazily_and_carries_them() {
    let newline = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "variable", "name": "v", "pattern": {"kind": "any"}},
        "expression": {
            "kind": "invocation",
            "expression": {"kind": "reference", "name": "eq"},
            "args": [
                {"kind": "reference", "name": "v"},
                {"kind": "value", "value": "\n"}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(spread(call(
            "filter",
            vec![literal(json!("a\nb\n")), newline],
        ))),
        r#"["\n","\n"]"#
    );
    let reject = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "variable", "name": "v", "pattern": {"kind": "any"}},
        "expression": {"kind": "value", "value": false}
    }))
    .unwrap();
    assert_eq!(
        evaluate(spread(
            call("filter", vec![literal(json!([1, 2])), reject],)
        )),
        "[]"
    );
    assert_eq!(parameter_names("filter"), ["self", "predicate"]);

    let ast = spread(call(
        "filter",
        vec![literal(json!([1, 2, 3, 4])), reference("pred")],
    ));
    let mut evaluation = Evaluation::with_hosts(
        ast,
        vec![crate::value::HostCallable {
            id: 1,
            name: "pred".into(),
            arity: 1,
        }],
    );
    assert!(evaluation.take_host_request().is_none());
    let mut calls = 0;
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                calls += 1;
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone()],
                            |_mc, args| {
                                let Value::Number(n) = args[0].raw() else {
                                    return Ok(Value::Boolean(false));
                                };
                                Ok(Value::Boolean(n % 2.0 == 0.0))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
        assert!(calls <= 4, "filter pulled before its source was drained");
    };
    assert_eq!(calls, 4);
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "[2,4]"
    );

    let ast = spread(call("filter", vec![reference("items"), reference("pred")]));
    let mut keep_ptr = 0usize;
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let keep = Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 });
        let Value::Located(located) = keep else {
            panic!("expected wrapper")
        };
        keep_ptr = uffda_heap::Gc::as_ptr(located) as usize;
        let items = Value::array(
            mc,
            vec![
                keep,
                Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 }),
            ],
        )
        .wrap(mc, Origin { start: 0, end: 2 });
        Environment::new(
            mc,
            None,
            vec![
                ("items".into(), items),
                (
                    "pred".into(),
                    Value::host(
                        mc,
                        crate::value::HostCallable {
                            id: 2,
                            name: "pred".into(),
                            arity: 1,
                        },
                    )
                    .wrap(mc, Origin { start: 0, end: 0 }),
                ),
            ],
        )
    });
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone()],
                            |mc, args| {
                                let keep = matches!(args[0].raw(), Value::Number(n) if n == 1.0);
                                Ok(Value::Boolean(keep).wrap(mc, Origin { start: 0, end: 0 }))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert_eq!(
        evaluation
            .read(&result, |value| {
                let Value::Array(items) = value else {
                    panic!("expected array")
                };
                assert_eq!(items.borrow().len(), 1);
                let Value::Located(located) = items.borrow()[0] else {
                    panic!("expected wrapped element")
                };
                uffda_heap::Gc::as_ptr(located) as usize
            })
            .unwrap(),
        keep_ptr
    );
}

#[test]
// req:standard-library-002 req:runtime-strings-002
fn slice_applies_bounds_and_keeps_character_and_element_identity() {
    assert_eq!(
        evaluate(call(
            "slice",
            vec![
                literal(json!("hello world")),
                literal(json!(0)),
                literal(json!(5)),
            ],
        )),
        r#""hello""#
    );
    assert_eq!(
        evaluate(call(
            "slice",
            vec![literal(json!("hello world")), literal(json!(6))],
        )),
        r#""world""#
    );
    assert_eq!(
        evaluate(call(
            "slice",
            vec![literal(json!("hello world")), literal(json!(-5))],
        )),
        r#""world""#
    );
    assert_eq!(
        evaluate(call(
            "slice",
            vec![
                literal(json!([1, 2, 3, 4])),
                literal(json!(1)),
                literal(json!(3)),
            ],
        )),
        "[2,3]"
    );
    assert_eq!(
        evaluate(call(
            "slice",
            vec![literal(json!([1, 2, 3, 4])), literal(json!(-2))],
        )),
        "[3,4]"
    );
    assert_eq!(parameter_names("slice"), ["value", "start", "end"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        assert!(
            invoke(
                mc,
                NativeGlobal::Slice,
                vec![Value::Number(42.0), Value::Number(0.0), Value::Number(1.0)],
                origin,
            )
            .is_err()
        );
        assert!(
            invoke(
                mc,
                NativeGlobal::Slice,
                vec![Value::Null, Value::Number(0.0), Value::Number(1.0)],
                origin,
            )
            .is_err()
        );
        let joined = crate::provenance::concatenate(
            mc,
            &[
                Value::string(mc, "a").wrap(mc, Origin { start: 3, end: 4 }),
                Value::string(mc, "b").wrap(mc, Origin { start: 7, end: 8 }),
            ],
            origin,
        )
        .unwrap();
        let sliced = match invoke(
            mc,
            NativeGlobal::Slice,
            vec![joined, Value::Number(1.0).wrap(mc, origin)],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(text(sliced).unwrap(), "b");
        assert_eq!(sliced.char_origin(0), Some(Origin { start: 7, end: 8 }));
        let item = Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 });
        let items =
            Value::array(mc, vec![Value::Number(1.0).wrap(mc, origin), item]).wrap(mc, origin);
        let sliced = match invoke(
            mc,
            NativeGlobal::Slice,
            vec![items, Value::Number(1.0)],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Array(elements) = sliced else {
            panic!("expected array")
        };
        assert!(elements.borrow()[0].same_wrapper(item));
        let source = Value::string(mc, "abcdef").wrap_root(mc);
        let sliced = match invoke(
            mc,
            NativeGlobal::Slice,
            vec![source, Value::Number(2.0), Value::Number(4.0)],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        assert_eq!(text(sliced).unwrap(), "cd");
        assert_eq!(sliced.char_origin(0), Some(Origin { start: 2, end: 3 }));
        assert_eq!(sliced.char_origin(1), Some(Origin { start: 3, end: 4 }));
    });
}

#[test]
// req:standard-library-002
fn iterable_normalizes_sources_and_yields_wrapped_characters() {
    assert_eq!(
        evaluate(spread(call("iterable", vec![literal(json!("abc"))]))),
        r#"["a","b","c"]"#
    );
    assert_eq!(
        evaluate(spread(call("iterable", vec![literal(json!([1, 2, 3]))],))),
        "[1,2,3]"
    );
    assert_eq!(parameter_names("iterable"), ["value"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let inner = iterator(
            mc,
            Value::array(mc, vec![Value::string(mc, "x"), Value::string(mc, "y")]),
        )
        .unwrap();
        let source = Value::Iterable(inner);
        let normalized = match invoke(mc, NativeGlobal::Iterable, vec![source], origin).unwrap() {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Iterable(out) = normalized else {
            panic!("expected iterable")
        };
        assert_eq!(
            uffda_heap::Gc::as_ptr(out) as usize,
            uffda_heap::Gc::as_ptr(inner) as usize
        );
        let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
            mc,
            normalized,
            Environment::new(mc, None, vec![]),
            origin,
        )
        .unwrap();
        while !execution.step(mc).unwrap() {}
        assert_eq!(
            json_text(execution.result().unwrap()).unwrap().unwrap(),
            r#"["x","y"]"#
        );
        for value in [Value::Number(7.0), Value::Null, Value::object(mc, vec![])] {
            assert!(invoke(mc, NativeGlobal::Iterable, vec![value], origin).is_err());
        }
        let joined = crate::provenance::concatenate(
            mc,
            &[
                Value::string(mc, "a").wrap(mc, Origin { start: 3, end: 4 }),
                Value::string(mc, "b").wrap(mc, Origin { start: 7, end: 8 }),
            ],
            origin,
        )
        .unwrap();
        let source = match invoke(mc, NativeGlobal::Iterable, vec![joined], origin).unwrap() {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Object(object) = source else {
            panic!("expected async iterator factory")
        };
        assert!(object.borrow().get_symbol("asyncIterator").is_some());
        let drain = |value| {
            let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
                mc,
                value,
                Environment::new(mc, None, vec![]),
                origin,
            )
            .unwrap();
            while !execution.step(mc).unwrap() {}
            execution.result().unwrap()
        };
        let first = drain(source);
        let Value::Array(items) = first.raw() else {
            panic!("expected array")
        };
        assert_eq!(items.borrow().len(), 2);
        assert_eq!(
            items.borrow()[0].origin(),
            Some(Origin { start: 3, end: 4 })
        );
        assert_eq!(
            items.borrow()[1].origin(),
            Some(Origin { start: 7, end: 8 })
        );
        let second = drain(source);
        let Value::Array(items) = second.raw() else {
            panic!("expected array")
        };
        assert_eq!(items.borrow().len(), 2);
    });
}

#[test]
// req:standard-library-002
fn map_projects_elements_lazily_and_keeps_wrapped_identity() {
    let bang = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "variable", "name": "v", "pattern": {"kind": "any"}},
        "expression": {
            "kind": "invocation",
            "expression": {"kind": "reference", "name": "format"},
            "args": [
                {"kind": "value", "value": "{0}!"},
                {"kind": "reference", "name": "v"}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(spread(call("map", vec![literal(json!("ab")), bang]))),
        r#"["a!","b!"]"#
    );
    assert_eq!(
        evaluate(spread(call(
            "map",
            vec![literal(json!([])), reference("id")],
        ))),
        "[]"
    );
    assert_eq!(parameter_names("map"), ["self", "callback"]);

    let mut evaluation = Evaluation::with_hosts(
        spread(call(
            "map",
            vec![literal(json!([1, 2, 3])), reference("project")],
        )),
        vec![crate::value::HostCallable {
            id: 3,
            name: "project".into(),
            arity: 1,
        }],
    );
    assert!(evaluation.take_host_request().is_none());
    let mut calls = 0;
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                calls += 1;
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone()],
                            |_mc, args| {
                                let Value::Number(n) = args[0].raw() else {
                                    return Err("expected number".into());
                                };
                                Ok(Value::Number(n * 2.0))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
        assert!(calls <= 3);
    };
    assert_eq!(calls, 3);
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "[2,4,6]"
    );

    let project = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "variable", "name": "entry", "pattern": {"kind": "any"}},
        "expression": {
            "kind": "member",
            "name": "value",
            "expression": {"kind": "reference", "name": "entry"}
        }
    }))
    .unwrap();
    let mut evaluation = Evaluation::with_hosts(
        spread(call(
            "map",
            vec![
                call(
                    "filter",
                    vec![
                        call("enumerate", vec![literal(json!(["a", "b", "c"]))]),
                        reference("even"),
                    ],
                ),
                project,
            ],
        )),
        vec![crate::value::HostCallable {
            id: 4,
            name: "even".into(),
            arity: 1,
        }],
    );
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone()],
                            |_mc, args| {
                                let Value::Object(object) = args[0].raw() else {
                                    return Ok(Value::Boolean(false));
                                };
                                let even = matches!(
                                    object.borrow().get("index").unwrap_or(Value::Undefined).raw(),
                                    Value::Number(index) if index % 2.0 == 0.0
                                );
                                Ok(Value::Boolean(even))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        r#"["a","c"]"#
    );

    let mut item_ptr = 0usize;
    let mut evaluation = Evaluation::with_environment(
        spread(call("map", vec![reference("items"), reference("callback")])),
        |mc| {
            let item = Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 });
            let Value::Located(located) = item else {
                panic!("expected wrapper")
            };
            item_ptr = uffda_heap::Gc::as_ptr(located) as usize;
            Environment::new(
                mc,
                None,
                vec![
                    (
                        "items".into(),
                        Value::array(mc, vec![item]).wrap(mc, Origin { start: 0, end: 1 }),
                    ),
                    (
                        "callback".into(),
                        Value::host(
                            mc,
                            crate::value::HostCallable {
                                id: 5,
                                name: "callback".into(),
                                arity: 1,
                            },
                        )
                        .wrap(mc, Origin { start: 0, end: 0 }),
                    ),
                ],
            )
        },
    );
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                assert_eq!(
                    evaluation
                        .read_with_provenance(&request.arguments[0], |value| {
                            let Value::Located(located) = value else {
                                panic!("callback must observe the wrapped element")
                            };
                            uffda_heap::Gc::as_ptr(located) as usize
                        })
                        .unwrap(),
                    item_ptr
                );
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::Rooted(
                            request.arguments[0].clone(),
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert_eq!(
        evaluation
            .read(&result, |value| {
                let Value::Array(items) = value.raw() else {
                    panic!("expected array")
                };
                let Value::Located(located) = items.borrow()[0] else {
                    panic!("expected wrapped element")
                };
                uffda_heap::Gc::as_ptr(located) as usize
            })
            .unwrap(),
        item_ptr
    );
}

#[test]
// req:standard-library-002
fn enumerate_pairs_elements_with_indexes_and_carries_wrapped_values() {
    assert_eq!(
        evaluate(spread(call(
            "enumerate",
            vec![literal(json!(["a", "b", "c"]))],
        ))),
        r#"[{"index":0,"value":"a"},{"index":1,"value":"b"},{"index":2,"value":"c"}]"#
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!("ab"))]))),
        r#"[{"index":0,"value":"a"},{"index":1,"value":"b"}]"#
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!([]))]))),
        "[]"
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!(""))]))),
        "[]"
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!("a😀b"))],))),
        "[{\"index\":0,\"value\":\"a\"},{\"index\":1,\"value\":\"😀\"},{\"index\":2,\"value\":\"b\"}]"
    );
    assert_eq!(
        evaluate(spread(call(
            "enumerate",
            vec![literal(json!({"a": 1, "b": 2}))],
        ))),
        r#"[{"index":"a","value":1},{"index":"b","value":2}]"#
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!(42))]))),
        r#"[{"index":0,"value":42}]"#
    );
    assert_eq!(
        evaluate(spread(call("enumerate", vec![literal(json!(null))]))),
        r#"[{"index":0,"value":null}]"#
    );
    assert_eq!(parameter_names("enumerate"), ["self"]);
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let values = Value::array(mc, vec![Value::string(mc, "a")]);
        let source = Value::object(mc, vec![]);
        let Value::Object(properties) = source else {
            panic!("expected object")
        };
        properties.borrow_mut(mc).set_symbol(
            "iterator".into(),
            Value::IteratorFactory(uffda_heap::Gc::new(mc, values)),
        );
        let enumerated = match invoke(mc, NativeGlobal::Enumerate, vec![source], origin).unwrap() {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Iterable(iterator) = enumerated else {
            panic!("expected iterable")
        };
        {
            let state = iterator.borrow();
            let IterableState::Enumerate { source, index: 0 } = &*state else {
                panic!("enumerate must not pull before it is drained")
            };
            let source = *source;
            drop(state);
            let IterableState::Custom { cursor: None, .. } = &*source.borrow() else {
                panic!("custom iterator factory must stay uncalled")
            };
        }
        let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
            mc,
            enumerated,
            Environment::new(mc, None, vec![]),
            origin,
        )
        .unwrap();
        while !execution.step(mc).unwrap() {}
        assert_eq!(
            json_text(execution.result().unwrap()).unwrap().unwrap(),
            r#"[{"index":0,"value":"a"}]"#
        );

        let item = Value::string(mc, "a").wrap(mc, Origin { start: 4, end: 5 });
        let enumerated = match invoke(
            mc,
            NativeGlobal::Enumerate,
            vec![Value::array(mc, vec![item]).wrap(mc, Origin { start: 4, end: 5 })],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
            mc,
            enumerated,
            Environment::new(mc, None, vec![]),
            origin,
        )
        .unwrap();
        while !execution.step(mc).unwrap() {}
        let Value::Array(entries) = execution.result().unwrap().raw() else {
            panic!("expected array")
        };
        let Value::Object(entry) = entries.borrow()[0] else {
            panic!("expected entry")
        };
        assert!(entry.borrow().get("value").unwrap().same_wrapper(item));

        let value = Value::Number(1.0).wrap(mc, Origin { start: 2, end: 3 });
        let enumerated = match invoke(
            mc,
            NativeGlobal::Enumerate,
            vec![
                Value::object(mc, vec![("x".into(), value)]).wrap(mc, Origin { start: 0, end: 3 }),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let mut execution = crate::evaluate::ExpressionExecution::collect_iterable(
            mc,
            enumerated,
            Environment::new(mc, None, vec![]),
            origin,
        )
        .unwrap();
        while !execution.step(mc).unwrap() {}
        let Value::Array(entries) = execution.result().unwrap().raw() else {
            panic!("expected array")
        };
        let Value::Object(entry) = entries.borrow()[0] else {
            panic!("expected entry")
        };
        assert_eq!(text(entry.borrow().get("index").unwrap()).unwrap(), "x");
        assert!(entry.borrow().get("value").unwrap().same_wrapper(value));
    });
}

fn double_appended(
    request_acc: crate::evaluate::RootedValue,
    request_item: crate::evaluate::RootedValue,
) -> crate::evaluate::HostCompletion {
    crate::evaluate::HostCompletion::materialize(vec![request_acc, request_item], |mc, args| {
        let Value::Array(existing) = args[0].raw() else {
            return Err("accumulator must be an array".into());
        };
        let mut items = existing.borrow().clone();
        let Value::Number(n) = args[1].raw() else {
            return Err("item must be a number".into());
        };
        items.push(Value::Number(n * 2.0));
        Ok(Value::array(mc, items))
    })
}

#[test]
// req:standard-library-002
fn reduce_folds_lazy_sources_and_passes_wrapped_elements() {
    assert_eq!(
        evaluate(call(
            "reduce",
            vec![
                literal(json!([1, 2, 3, 4])),
                literal(json!(0)),
                reference("add"),
            ],
        )),
        "10"
    );
    let doubled = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "then", "patterns": [
            {"kind": "variable", "name": "acc", "pattern": {"kind": "any"}},
            {"kind": "variable", "name": "item", "pattern": {"kind": "any"}}
        ]},
        "expression": {
            "kind": "invocation",
            "expression": {"kind": "reference", "name": "format"},
            "args": [
                {"kind": "value", "value": "{0}{1}{1}"},
                {"kind": "reference", "name": "acc"},
                {"kind": "reference", "name": "item"}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(call(
            "reduce",
            vec![literal(json!("abc")), literal(json!("")), doubled],
        )),
        r#""aabbcc""#
    );
    let collected = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "then", "patterns": [
            {"kind": "variable", "name": "acc", "pattern": {"kind": "any"}},
            {"kind": "variable", "name": "item", "pattern": {"kind": "any"}}
        ]},
        "expression": {
            "kind": "array",
            "expressions": [
                {"kind": "arraySpread", "expression": {"kind": "reference", "name": "acc"}},
                {"kind": "arrayElement", "expression": {"kind": "reference", "name": "item"}}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(call(
            "reduce",
            vec![literal(json!("a😀b")), literal(json!([])), collected,],
        )),
        "[\"a\",\"😀\",\"b\"]"
    );
    assert_eq!(
        evaluate(call(
            "reduce",
            vec![literal(json!([])), literal(json!(42)), reference("id")],
        )),
        "42"
    );
    assert_eq!(parameter_names("reduce"), ["self", "initial", "fn"]);
    for value in [json!(42), json!(null)] {
        let mut evaluation = Evaluation::new(call(
            "reduce",
            vec![literal(value), literal(json!(0)), reference("id")],
        ));
        assert!(evaluation.finish().is_err());
    }

    let mut evaluation = Evaluation::with_hosts(
        call(
            "reduce",
            vec![
                literal(json!([1, 2, 3])),
                literal(json!([])),
                reference("step"),
            ],
        ),
        vec![crate::value::HostCallable {
            id: 6,
            name: "step".into(),
            arity: 2,
        }],
    );
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(double_appended(
                            request.arguments[0].clone(),
                            request.arguments[1].clone(),
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "[2,4,6]"
    );

    let project = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "variable", "name": "entry", "pattern": {"kind": "any"}},
        "expression": {
            "kind": "member",
            "name": "value",
            "expression": {"kind": "reference", "name": "entry"}
        }
    }))
    .unwrap();
    let mut evaluation = Evaluation::with_hosts(
        call(
            "reduce",
            vec![
                call(
                    "map",
                    vec![
                        call(
                            "filter",
                            vec![
                                call("enumerate", vec![literal(json!([1, 2, 3, 4]))]),
                                reference("even"),
                            ],
                        ),
                        project,
                    ],
                ),
                literal(json!(0)),
                reference("add"),
            ],
        ),
        vec![crate::value::HostCallable {
            id: 7,
            name: "even".into(),
            arity: 1,
        }],
    );
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone()],
                            |_mc, args| {
                                let Value::Object(object) = args[0].raw() else {
                                    return Ok(Value::Boolean(false));
                                };
                                let even = matches!(
                                    object.borrow().get("index").unwrap_or(Value::Undefined).raw(),
                                    Value::Number(index) if index % 2.0 == 0.0
                                );
                                Ok(Value::Boolean(even))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "4"
    );

    let mut evaluation = Evaluation::with_environment(
        call(
            "reduce",
            vec![reference("items"), literal(json!(0)), reference("step")],
        ),
        |mc| {
            Environment::new(
                mc,
                None,
                vec![
                    (
                        "items".into(),
                        Value::array(
                            mc,
                            vec![
                                Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 }),
                                Value::Number(2.0).wrap(mc, Origin { start: 1, end: 2 }),
                            ],
                        )
                        .wrap(mc, Origin { start: 0, end: 2 }),
                    ),
                    (
                        "step".into(),
                        Value::host(
                            mc,
                            crate::value::HostCallable {
                                id: 8,
                                name: "step".into(),
                                arity: 2,
                            },
                        )
                        .wrap(mc, Origin { start: 0, end: 0 }),
                    ),
                ],
            )
        },
    );
    let mut saw_wrapper = false;
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                let request = evaluation.take_host_request().unwrap();
                saw_wrapper |= evaluation
                    .read_with_provenance(&request.arguments[1], |value| {
                        matches!(value, Value::Located(_))
                    })
                    .unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone(), request.arguments[1].clone()],
                            |_mc, args| {
                                let Value::Number(acc) = args[0].raw() else {
                                    return Err("accumulator must be a number".into());
                                };
                                let Value::Number(item) = args[1].raw() else {
                                    return Err("item must be a number".into());
                                };
                                Ok(Value::Number(acc + item))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
    };
    assert!(saw_wrapper);
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "3"
    );
}

#[test]
// req:standard-library-002
fn scan_yields_running_accumulators_without_starting_early() {
    assert_eq!(
        evaluate(spread(call(
            "scan",
            vec![
                literal(json!([1, 2, 3, 4])),
                literal(json!(0)),
                reference("add"),
            ],
        ))),
        "[1,3,6,10]"
    );
    let appended = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "then", "patterns": [
            {"kind": "variable", "name": "acc", "pattern": {"kind": "any"}},
            {"kind": "variable", "name": "item", "pattern": {"kind": "any"}}
        ]},
        "expression": {
            "kind": "invocation",
            "expression": {"kind": "reference", "name": "format"},
            "args": [
                {"kind": "value", "value": "{0}{1}"},
                {"kind": "reference", "name": "acc"},
                {"kind": "reference", "name": "item"}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(spread(call(
            "scan",
            vec![literal(json!("abc")), literal(json!("")), appended],
        ))),
        r#"["a","ab","abc"]"#
    );
    let collected = serde_json::from_value(json!({
        "kind": "lambda",
        "pattern": {"kind": "then", "patterns": [
            {"kind": "variable", "name": "acc", "pattern": {"kind": "any"}},
            {"kind": "variable", "name": "item", "pattern": {"kind": "any"}}
        ]},
        "expression": {
            "kind": "array",
            "expressions": [
                {"kind": "arraySpread", "expression": {"kind": "reference", "name": "acc"}},
                {"kind": "arrayElement", "expression": {"kind": "reference", "name": "item"}}
            ]
        }
    }))
    .unwrap();
    assert_eq!(
        evaluate(spread(call(
            "scan",
            vec![literal(json!("a😀b")), literal(json!([])), collected],
        ))),
        "[[\"a\"],[\"a\",\"😀\"],[\"a\",\"😀\",\"b\"]]"
    );
    assert_eq!(
        evaluate(spread(call(
            "scan",
            vec![literal(json!([])), literal(json!(42)), reference("id")],
        ))),
        "[]"
    );
    assert_eq!(parameter_names("scan"), ["self", "initial", "fn"]);
    for value in [json!(42), json!(null)] {
        let mut evaluation = Evaluation::new(spread(call(
            "scan",
            vec![literal(value), literal(json!(0)), reference("id")],
        )));
        assert!(evaluation.finish().is_err());
    }
    rootless_mutate(|mc| {
        let origin = Origin { start: 0, end: 0 };
        let scanned = match invoke(
            mc,
            NativeGlobal::Scan,
            vec![
                Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]),
                Value::Number(0.0),
                Value::Native(NativeGlobal::Add),
            ],
            origin,
        )
        .unwrap()
        {
            NativeResult::Value(value) => value,
            NativeResult::Reduce { .. } => panic!("expected value"),
        };
        let Value::Iterable(iterator) = scanned else {
            panic!("expected iterable")
        };
        {
            let state = iterator.borrow();
            let IterableState::Scan { source, .. } = &*state else {
                panic!("expected scan")
            };
            let source = *source;
            drop(state);
            assert!(matches!(&*source.borrow(), IterableState::Deferred { .. }));
        }
    });

    let mut evaluation = Evaluation::with_hosts(
        spread(call(
            "scan",
            vec![
                literal(json!([1, 2, 3])),
                literal(json!(0)),
                reference("step"),
            ],
        )),
        vec![crate::value::HostCallable {
            id: 9,
            name: "step".into(),
            arity: 2,
        }],
    );
    assert!(evaluation.take_host_request().is_none());
    let mut calls = 0;
    let result = loop {
        match evaluation.step_status().unwrap() {
            crate::evaluate::StepStatus::Complete => break evaluation.finish().unwrap(),
            crate::evaluate::StepStatus::Yielded => {}
            crate::evaluate::StepStatus::Suspended => {
                calls += 1;
                let request = evaluation.take_host_request().unwrap();
                evaluation
                    .complete_host(
                        &request,
                        Ok(crate::evaluate::HostCompletion::materialize(
                            vec![request.arguments[0].clone(), request.arguments[1].clone()],
                            |_mc, args| {
                                let Value::Number(acc) = args[0].raw() else {
                                    return Err("accumulator must be a number".into());
                                };
                                let Value::Number(item) = args[1].raw() else {
                                    return Err("item must be a number".into());
                                };
                                Ok(Value::Number(acc + item))
                            },
                        )),
                    )
                    .unwrap();
            }
        }
        assert!(calls <= 3);
    };
    assert_eq!(calls, 3);
    assert_eq!(
        evaluation
            .read(&result, |value| json_text(value).unwrap().unwrap())
            .unwrap(),
        "[1,3,6]"
    );

    let started = std::time::Instant::now();
    let mut evaluation = Evaluation::with_environment(
        spread(call(
            "scan",
            vec![reference("items"), literal(json!(0)), reference("add")],
        )),
        |mc| {
            Environment::new(
                mc,
                None,
                vec![(
                    "items".into(),
                    Value::array(mc, (0..4_000).map(|n| Value::Number(n as f64)).collect()),
                )],
            )
        },
    );
    let result = evaluation.finish().unwrap();
    let elapsed = started.elapsed();
    assert!(
        elapsed.as_secs() < 5,
        "scan over 4000 numbers took {elapsed:?}"
    );
    assert_eq!(
        evaluation
            .read(&result, |value| {
                let Value::Array(items) = value.raw() else {
                    panic!("expected array")
                };
                let last = *items.borrow().last().unwrap();
                json_text(last).unwrap().unwrap()
            })
            .unwrap(),
        "7998000"
    );
}

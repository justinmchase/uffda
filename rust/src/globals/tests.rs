use super::*;

#[test]
// req:runtime-core-014
fn external_input_iterator_creation_does_not_pull_or_require_an_executor() {
    gc_arena::arena::rootless_mutate(|mc| {
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
use gc_arena::arena::rootless_mutate;
use serde_json::json;

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
    for fixture in fixtures {
        let global = lookup(&fixture.name).expect("fixture global exists");
        assert_eq!(global.name(), fixture.name.as_str());
        assert_eq!(global.arity(), fixture.arity);
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
            Value::Symbol(gc_arena::Gc::new(mc, "uffda-native-id".into())),
            Value::Bytes(gc_arena::Gc::new(mc, vec![1, 2, 3])),
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
                vec![Value::Bytes(gc_arena::Gc::new(mc, vec![0, 0]))]
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

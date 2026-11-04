use super::{CompiledExpression, Evaluation, EvaluationError};
use crate::coercion::StringCoercionError;
use crate::environment::Environment;
use crate::expression::Expression;
use crate::globals::NativeGlobal;
use crate::pattern::{MatchKind, Pattern, PatternError, PatternExecution};
use crate::provenance::Origin;
use crate::value::Value;
use serde_json::{Value as Json, json};
use uffda_heap::Gc;

fn expression(source: Json) -> Expression {
    serde_json::from_value(source).unwrap()
}

fn expect(value: Value<'_>, expected: &Json) {
    match (value.raw(), expected) {
        (Value::Null, Json::Null) => {}
        (Value::Boolean(actual), Json::Bool(expected)) => assert_eq!(actual, *expected),
        (Value::Number(actual), Json::Number(expected)) => {
            assert!(matches!(actual, number if Some(number) == expected.as_f64()));
        }
        (Value::String(actual), Json::String(expected)) => {
            assert_eq!(actual.to_utf8().expect("scalar text"), *expected);
        }
        (Value::Array(actual), Json::Array(expected)) => {
            let actual: Vec<Value<'_>> = actual.borrow().iter().copied().collect();
            assert_eq!(actual.len(), expected.len());
            for (item, expected) in actual.iter().zip(expected) {
                expect(*item, expected);
            }
        }
        (Value::Object(actual), Json::Object(expected)) => {
            let actual = actual.borrow();
            assert_eq!(actual.entries().len(), expected.len());
            for (key, expected) in expected {
                let Some(item) = actual.get(key.as_str()) else {
                    panic!("missing {key}");
                };
                expect(item, expected);
            }
        }
        (other, _) => panic!("unexpected {}", other.runtime_type()),
    }
}

fn assert_expr(source: Json, expected: Json) {
    let mut evaluation = Evaluation::new(expression(source));
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &expected))
        .unwrap();
}

fn assert_error(source: Json, expected: EvaluationError) {
    assert_eq!(
        Evaluation::new(expression(source)).finish().unwrap_err(),
        expected
    );
}

fn is_number(value: Value<'_>, expected: f64) -> bool {
    matches!(value.raw(), Value::Number(actual) if actual == expected)
}

fn compiled_module(declaration: Json) -> (url::Url, crate::module::CompiledModuleGraph) {
    let url = url::Url::parse("file:///injected-module.json").unwrap();
    let mut resolver = crate::resolver::Resolver::from_cwd().unwrap();
    resolver.insert_declaration(
        url.clone(),
        crate::resolver::decode_declaration(&url, &declaration.to_string()).unwrap(),
    );
    let compiled =
        crate::module::CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap();
    (url, compiled)
}

#[test]
// req:expressions-runtime-004
fn port_string_literal_segment_evaluates_to_itself() {
    assert_expr(json!({"kind":"string","values":["abc"]}), json!("abc"));
}

#[test]
// req:expressions-runtime-004
fn port_string_concatenates_literal_number_and_nested_string_in_order() {
    assert_expr(
        json!({"kind":"string","values":[
            "abc",
            {"kind":"number","value":123},
            {"kind":"string","values":["xyz"]}
        ]}),
        json!("abc123xyz"),
    );
}

#[test]
// req:expressions-runtime-004 req:expressions-runtime-008
fn port_string_immediate_segments_evaluate_to_the_concatenation() {
    assert_expr(
        json!({"kind":"string","values":["a",{"kind":"number","value":1}]}),
        json!("a1"),
    );
}

#[test]
// req:expressions-runtime-004 req:runtime-core-012
fn port_string_interpolation_rejects_objects_arrays_and_tostring_hooks() {
    assert_error(
        json!({"kind":"string","values":[{"kind":"value","value":{}}]}),
        EvaluationError::StringCoercion(StringCoercionError::CompositeConversion),
    );
    assert_error(
        json!({"kind":"string","values":[{"kind":"value","value":[]}]}),
        EvaluationError::StringCoercion(StringCoercionError::CompositeConversion),
    );
    let ast = expression(json!({"kind":"string","values":[{"kind":"reference","name":"x"}]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let hidden = CompiledExpression::new(expression(json!({"kind":"value","value":"hidden"})))
            .bind(
                mc,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Pattern::End,
            );
        Environment::new(
            mc,
            None,
            vec![(
                "x".into(),
                Value::object(mc, vec![("toString".into(), hidden)]),
            )],
        )
    });
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::StringCoercion(StringCoercionError::CompositeConversion)
    );
}

#[test]
// req:expressions-runtime-004 req:runtime-core-012
fn port_string_interpolation_rejects_callables() {
    assert_error(
        json!({"kind":"string","values":[{"kind":"reference","name":"add"}]}),
        EvaluationError::StringCoercion(StringCoercionError::CallableConversion),
    );
    assert_error(
        json!({"kind":"string","values":[{"kind":"lambda","pattern":{"kind":"end"},
            "expression":{"kind":"number","value":1}}]}),
        EvaluationError::StringCoercion(StringCoercionError::CallableConversion),
    );
}

#[test]
// req:expressions-runtime-004
fn port_string_keeps_each_interpolated_characters_provenance() {
    let ast = expression(json!({"kind":"string","values":[{"kind":"reference","name":"x"},"!"]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "x".into(),
                Value::string(mc, "a").wrap(mc, Origin { start: 6, end: 7 }),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read_with_provenance(&result, |value| {
            assert_eq!(crate::coercion::string_text(value).unwrap(), "a!");
            assert_eq!(value.char_origin(0), Some(Origin { start: 6, end: 7 }));
            assert_eq!(value.char_origin(1), Some(Origin { start: 0, end: 0 }));
        })
        .unwrap();
}

#[test]
// req:expressions-runtime-005
fn port_member_reads_a_scope_object_property() {
    let ast = expression(
        json!({"kind":"member","name":"y","expression":{"kind":"reference","name":"x"}}),
    );
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "x".into(),
                Value::object(mc, vec![("y".into(), Value::Number(7.0))]),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| is_number(value, 7.0))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-005
fn port_member_propagates_an_unresolved_base_reference() {
    assert_error(
        json!({"kind":"member","name":"x","expression":{"kind":"reference","name":"a"}}),
        EvaluationError::UnknownReference("a".into()),
    );
}

#[test]
// req:expressions-runtime-005
fn port_member_missing_property_is_undefined() {
    let ast = expression(
        json!({"kind":"member","name":"x","expression":{"kind":"reference","name":"a"}}),
    );
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("a".into(), Value::object(mc, vec![]))])
    });
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| matches!(value.raw(), Value::Undefined))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-008
fn port_member_immediate_value_projects_its_property() {
    assert_expr(
        json!({"kind":"member","name":"x","expression":{"kind":"value","value":{"x":1}}}),
        json!(1),
    );
}

#[test]
// req:expressions-runtime-005 req:runtime-core-012
fn port_member_callable_name_is_metadata() {
    let name = expression(json!({
        "kind":"member","name":"name",
        "expression":{"kind":"reference","name":"named"}
    }));
    let mut evaluation = Evaluation::with_hosts(
        name,
        vec![crate::value::HostCallable {
            id: 1,
            name: "named".into(),
            arity: 0,
        }],
    );
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| {
            assert_eq!(crate::coercion::string_text(value).unwrap(), "named");
        })
        .unwrap();
}

#[test]
// req:expressions-runtime-005 req:runtime-memory-001
fn port_member_returns_the_propertys_own_wrapper() {
    let ast = expression(json!({
        "kind":"member","name":"name",
        "expression":{"kind":"reference","name":"x"}
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let name = Value::string(mc, "a").wrap(mc, Origin { start: 5, end: 6 });
        let object =
            Value::object(mc, vec![("name".into(), name)]).wrap(mc, Origin { start: 4, end: 7 });
        Environment::new(mc, None, vec![("x".into(), object)])
    });
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        let property = state.environment.get("x").unwrap();
        let Value::Object(object) = property.raw() else {
            panic!("expected object");
        };
        assert!(value.same_wrapper(object.borrow().get("name").unwrap()));
    });
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-012
fn port_array_appends_referenced_elements_in_order() {
    let ast = expression(json!({"kind":"array","expressions":[
        {"kind":"arrayElement","expression":{"kind":"reference","name":"a"}},
        {"kind":"arrayElement","expression":{"kind":"reference","name":"b"}}
    ]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![
                ("a".into(), Value::Number(7.0)),
                ("b".into(), Value::Number(11.0)),
            ],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!([7, 11])))
        .unwrap();
}

#[test]
// req:expressions-runtime-006
fn port_array_empty_literal_is_an_empty_array() {
    assert_expr(json!({"kind":"array","expressions":[]}), json!([]));
}

#[test]
// req:expressions-runtime-006
fn port_array_nests_a_referenced_empty_array() {
    let ast = expression(json!({"kind":"array","expressions":[{
        "kind":"arrayElement",
        "expression":{"kind":"array","expressions":[{
            "kind":"arrayElement",
            "expression":{"kind":"reference","name":"a"}
        }]}
    }]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("a".into(), Value::array(mc, vec![]))])
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!([[[]]])))
        .unwrap();
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-007
fn port_array_spread_expands_nested_arrays_in_declaration_order() {
    assert_expr(
        json!({"kind":"array","expressions":[{
            "kind":"arraySpread",
            "expression":{"kind":"array","expressions":[
                {"kind":"arrayElement","expression":{"kind":"value","value":7}},
                {"kind":"arrayElement","expression":{"kind":"value","value":11}}
            ]}
        }]}),
        json!([7, 11]),
    );
    assert_expr(
        json!({"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"array","expressions":[
                {"kind":"arrayElement","expression":{"kind":"value","value":7}},
                {"kind":"arrayElement","expression":{"kind":"value","value":11}}
            ]}},
            {"kind":"arraySpread","expression":{"kind":"array","expressions":[
                {"kind":"arrayElement","expression":{"kind":"value","value":13}}
            ]}}
        ]}),
        json!([[7, 11], 13]),
    );
    assert_expr(
        json!({"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"value","value":[]}},
            {"kind":"arraySpread","expression":{"kind":"array","expressions":[
                {"kind":"arrayElement","expression":{"kind":"value","value":7}},
                {"kind":"arrayElement","expression":{"kind":"value","value":11}}
            ]}}
        ]}),
        json!([[], 7, 11]),
    );
    assert_expr(
        json!({"kind":"array","expressions":[{
            "kind":"arraySpread",
            "expression":{"kind":"array","expressions":[
                {"kind":"arraySpread","expression":{"kind":"array","expressions":[
                    {"kind":"arrayElement","expression":{"kind":"value","value":7}},
                    {"kind":"arrayElement","expression":{"kind":"value","value":11}}
                ]}},
                {"kind":"arrayElement","expression":{"kind":"value","value":13}}
            ]}
        }]}),
        json!([7, 11, 13]),
    );
    assert_expr(
        json!({"kind":"array","expressions":[{
            "kind":"arraySpread",
            "expression":{"kind":"value","value":{"x":7,"y":11}}
        }]}),
        json!([["x", 7], ["y", 11]]),
    );
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-007
fn port_array_spread_of_a_number_is_not_iterable() {
    assert_error(
        json!({"kind":"array","expressions":[{
            "kind":"arraySpread",
            "expression":{"kind":"value","value":7}
        }]}),
        EvaluationError::NotIterable,
    );
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-008
fn port_array_immediate_element_and_spread_compose_in_order() {
    assert_expr(
        json!({"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"number","value":1}},
            {"kind":"arraySpread","expression":{"kind":"value","value":[2,3]}}
        ]}),
        json!([1, 2, 3]),
    );
}

#[test]
// req:expressions-runtime-006 req:runtime-memory-001
fn port_array_carries_wrapped_elements_and_takes_the_evaluation_origin() {
    let ast = expression(json!({"kind":"array","expressions":[{
        "kind":"arrayElement",
        "expression":{"kind":"reference","name":"x"}
    }]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "x".into(),
                Value::Number(1.0).wrap(mc, Origin { start: 2, end: 3 }),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        assert_eq!(value.origin(), Some(Origin { start: 0, end: 0 }));
        let Value::Array(items) = value.raw() else {
            panic!("expected array");
        };
        assert!(items.borrow()[0].same_wrapper(state.environment.get("x").unwrap()));
    });
}

#[test]
// req:expressions-runtime-006
fn port_object_assigns_keys_and_later_keys_replace_earlier_ones() {
    assert_expr(
        json!({"kind":"object","keys":[
            {"kind":"objectKey","name":"x","expression":{"kind":"value","value":7}},
            {"kind":"objectKey","name":"y","expression":{"kind":"value","value":11}}
        ]}),
        json!({"x":7,"y":11}),
    );
    assert_expr(
        json!({"kind":"object","keys":[
            {"kind":"objectKey","name":"x","expression":{"kind":"value","value":7}},
            {"kind":"objectKey","name":"x","expression":{"kind":"value","value":11}}
        ]}),
        json!({"x":11}),
    );
    assert_expr(json!({"kind":"object","keys":[]}), json!({}));
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-007
fn port_object_spreads_merge_in_declaration_order() {
    assert_expr(
        json!({"kind":"object","keys":[{
            "kind":"objectSpread",
            "expression":{"kind":"value","value":{"x":7,"y":11}}
        }]}),
        json!({"x":7,"y":11}),
    );
    assert_expr(
        json!({"kind":"object","keys":[
            {"kind":"objectSpread","expression":{"kind":"value","value":{"x":7,"y":11}}},
            {"kind":"objectSpread","expression":{"kind":"value","value":{"y":13,"z":19}}}
        ]}),
        json!({"x":7,"y":13,"z":19}),
    );
    assert_expr(
        json!({"kind":"object","keys":[
            {"kind":"objectSpread","expression":{"kind":"value","value":{"x":7,"y":11}}},
            {"kind":"objectKey","name":"x","expression":{"kind":"value","value":13}},
            {"kind":"objectSpread","expression":{"kind":"value","value":{"z":19}}}
        ]}),
        json!({"x":13,"y":11,"z":19}),
    );
}

#[test]
// req:expressions-runtime-006
fn port_object_computed_string_key_assigns_the_evaluated_name() {
    assert_expr(
        json!({"kind":"object","keys":[{
            "kind":"objectComputedKey",
            "keyExpression":{"kind":"value","value":"dynamic"},
            "expression":{"kind":"value","value":7}
        }]}),
        json!({"dynamic":7}),
    );
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-012
fn port_object_computed_key_accepts_arbitrary_runtime_values() {
    for key in [json!(null), json!(true), json!([]), json!({})] {
        let mut evaluation = Evaluation::new(expression(json!({"kind":"object","keys":[{
            "kind":"objectComputedKey",
            "keyExpression":{"kind":"value","value":key},
            "expression":{"kind":"value","value":1}
        }]})));
        let result = evaluation.finish().unwrap();
        evaluation
            .read(&result, |value| {
                let Value::Object(object) = value.raw() else {
                    panic!("computed object literal returns an Object")
                };
                let object = object.borrow();
                assert_eq!(object.entries().len(), 1);
                assert!(matches!(
                    object.entries()[0].0,
                    crate::value::AssociationKey::Value(_)
                ));
            })
            .unwrap();
    }
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-008
fn port_object_immediate_key_evaluates_to_the_object() {
    assert_expr(
        json!({"kind":"object","keys":[{
            "kind":"objectKey","name":"a","expression":{"kind":"number","value":1}
        }]}),
        json!({"a":1}),
    );
}

#[test]
// req:expressions-runtime-006 req:expressions-runtime-007 req:runtime-memory-001
fn port_object_keeps_named_values_and_symbol_key_identity() {
    let ast = expression(json!({"kind":"object","keys":[
        {"kind":"objectKey","name":"a","expression":{"kind":"reference","name":"x"}},
        {"kind":"objectComputedKey",
         "keyExpression":{"kind":"invocation",
            "expression":{"kind":"reference","name":"symbol"},
            "args":[{"kind":"string","values":["iterator"]}]},
         "expression":{"kind":"reference","name":"x"}}
    ]}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "x".into(),
                Value::Number(1.0).wrap(mc, Origin { start: 2, end: 3 }),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        assert_eq!(value.origin(), Some(Origin { start: 0, end: 0 }));
        let Value::Object(object) = value.raw() else {
            panic!("expected object");
        };
        let object = object.borrow();
        assert!(
            object
                .get("a")
                .unwrap()
                .same_wrapper(state.environment.get("x").unwrap())
        );
        assert!(object.has_symbol_keys());
        let iterator = object.get_symbol("iterator").unwrap();
        assert!(is_number(iterator, 1.0));
        assert_eq!(iterator.origin(), Some(Origin { start: 2, end: 3 }));
    });
}

#[test]
// req:expressions-runtime-005
fn port_reference_reads_the_named_scope_binding() {
    for (name, expected) in [("a", 7.0), ("b", 11.0)] {
        let ast = expression(json!({"kind":"reference","name":name}));
        let mut evaluation = Evaluation::with_environment(ast, |mc| {
            Environment::new(
                mc,
                None,
                vec![
                    ("a".into(), Value::Number(7.0)),
                    ("b".into(), Value::Number(11.0)),
                ],
            )
        });
        let result = evaluation.finish().unwrap();
        assert!(
            evaluation
                .read(&result, |value| is_number(value, expected))
                .unwrap()
        );
    }
}

#[test]
// req:expressions-runtime-005
fn port_reference_unknown_name_is_an_unknown_reference() {
    assert_error(
        json!({"kind":"reference","name":"missing"}),
        EvaluationError::UnknownReference("missing".into()),
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-010
fn port_reference_this_is_the_current_match() {
    let mut evaluation = Evaluation::new(expression(json!({"kind":"reference","name":"this"})));
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        let Value::Match(matched) = value.raw() else {
            panic!("expected match, got {}", value.raw().runtime_type());
        };
        assert_eq!(matched.kind, MatchKind::Ok);
        assert!(Gc::ptr_eq(matched, state.current_match.unwrap()));
    });
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-010
fn port_reference_this_uses_an_explicit_subject() {
    let mut evaluation = Evaluation::new(expression(json!({"kind":"reference","name":"this"})));
    evaluation.arena.mutate_root(|mc, state| {
        state.set_subject(Value::object(
            mc,
            vec![("name".into(), Value::string(mc, "Example"))],
        ));
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!({"name":"Example"})))
        .unwrap();
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-008
fn port_reference_immediate_binding_evaluates_to_the_value() {
    let ast = expression(json!({"kind":"reference","name":"x"}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("x".into(), Value::Number(1.0))])
    });
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| is_number(value, 1.0))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-010
fn port_reference_resolves_global_this_and_current_value() {
    let mut join = Evaluation::with_match(
        expression(json!({"kind":"reference","name":"join"})),
        |mc| {
            let mut pattern = PatternExecution::new(
                mc,
                Pattern::Any,
                vec![Value::string(mc, "value")],
                Environment::new(mc, None, vec![("x".into(), Value::Number(1.0))]),
            );
            while !pattern.step(mc).unwrap() {}
            pattern.result().unwrap()
        },
    );
    let join_result = join.finish().unwrap();
    join.arena.mutate(|_, state| {
        let value = *state.external.fetch(&join_result.0);
        let matched = state.current_match.unwrap();
        assert!(value.raw().strict_eq(Value::Native(NativeGlobal::Join)));
        assert_eq!(value.origin(), Some(matched.origin));
    });

    let mut current =
        Evaluation::with_match(expression(json!({"kind":"reference","name":"_"})), |mc| {
            let mut pattern = PatternExecution::new(
                mc,
                Pattern::Any,
                vec![Value::string(mc, "value")],
                Environment::new(mc, None, vec![]),
            );
            while !pattern.step(mc).unwrap() {}
            pattern.result().unwrap()
        });
    let current_result = current.finish().unwrap();
    current
        .read(&current_result, |value| {
            assert_eq!(crate::coercion::string_text(value).unwrap(), "value");
        })
        .unwrap();
    current.arena.mutate(|_, state| {
        let value = *state.external.fetch(&current_result.0);
        assert!(value.raw().strict_eq(state.current_match.unwrap().value));
    });

    let mut this_match = Evaluation::with_match(
        expression(json!({"kind":"reference","name":"this"})),
        |mc| {
            let mut pattern = PatternExecution::new(
                mc,
                Pattern::Any,
                vec![Value::string(mc, "value")],
                Environment::new(mc, None, vec![]),
            );
            while !pattern.step(mc).unwrap() {}
            pattern.result().unwrap()
        },
    );
    let this_result = this_match.finish().unwrap();
    this_match.arena.mutate(|_, state| {
        let value = *state.external.fetch(&this_result.0);
        let Value::Match(matched) = value.raw() else {
            panic!("expected match");
        };
        assert!(Gc::ptr_eq(matched, state.current_match.unwrap()));
    });
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-011
fn port_reference_rule_info_follows_variables_and_ignores_parameter_names() {
    let (url, compiled) = compiled_module(json!({
        "imports": [],
        "exports": [],
        "rules": [{
            "name": "Format",
            "parameters": [{"name": "W"}],
            "pattern": {"kind": "ok"}
        }],
        "funcs": [],
        "decorators": []
    }));
    let ast = expression(json!({"kind":"reference","name":"Format"}));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        crate::module::ModuleBindings::new(mc, &compiled)
            .unwrap()
            .environment(&url)
            .unwrap()
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| {
            assert_eq!(
                crate::globals::json_text(value).unwrap().unwrap(),
                format!(
                    r#"{{"kind":"rule","name":"Format","moduleUrl":"{url}","parameters":["W"]}}"#
                )
            );
        })
        .unwrap();

    assert_eq!(
        Evaluation::with_environment(expression(json!({"kind":"reference","name":"L"})), |mc| {
            crate::module::ModuleBindings::new(mc, &compiled)
                .unwrap()
                .environment(&url)
                .unwrap()
        },)
        .finish()
        .unwrap_err(),
        EvaluationError::UnknownReference("L".into())
    );
    assert_eq!(
        Evaluation::with_environment(expression(json!({"kind":"reference","name":"W"})), |mc| {
            crate::module::ModuleBindings::new(mc, &compiled)
                .unwrap()
                .environment(&url)
                .unwrap()
        },)
        .finish()
        .unwrap_err(),
        EvaluationError::UnknownReference("W".into())
    );

    let mut shadowed = Evaluation::with_environment(
        expression(json!({"kind":"reference","name":"Format"})),
        |mc| {
            let module = crate::module::ModuleBindings::new(mc, &compiled)
                .unwrap()
                .environment(&url)
                .unwrap();
            Environment::new(
                mc,
                Some(module),
                vec![("Format".into(), Value::Number(1.0))],
            )
        },
    );
    let result = shadowed.finish().unwrap();
    assert!(
        shadowed
            .read(&result, |value| is_number(value, 1.0))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-007
fn port_invocation_passes_a_non_spread_array_argument_whole() {
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"lambda","pattern":{"kind":"then","patterns":[
            {"kind":"variable","name":"x","pattern":{"kind":"any"}},
            {"kind":"variable","name":"y","pattern":{"kind":"any"}}
        ]},
        "expression":{"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"reference","name":"x"}},
            {"kind":"arrayElement","expression":{"kind":"reference","name":"y"}}
        ]}},
        "args":[
            {"kind":"reference","name":"a"},
            {"kind":"reference","name":"b"}
        ]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![
                (
                    "a".into(),
                    Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]),
                ),
                ("b".into(), Value::Undefined),
            ],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| {
            let Value::Array(args) = value.raw() else {
                panic!("expected array");
            };
            let args = args.borrow();
            assert_eq!(args.len(), 2);
            expect(args[0], &json!([1, 2]));
            assert!(matches!(args[1].raw(), Value::Undefined));
        })
        .unwrap();
}

#[test]
// req:expressions-runtime-007
fn port_invocation_calls_add_and_a_zero_argument_lambda() {
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"reference","name":"add"},
        "args":[
            {"kind":"reference","name":"a"},
            {"kind":"reference","name":"b"}
        ]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![
                ("a".into(), Value::Number(7.0)),
                ("b".into(), Value::Number(11.0)),
            ],
        )
    });
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| is_number(value, 18.0))
            .unwrap()
    );
    assert_expr(
        json!({
            "kind":"invocation",
            "expression":{"kind":"lambda","pattern":{"kind":"end"},
                "expression":{"kind":"value","value":"uffda"}},
            "args":[]
        }),
        json!("uffda"),
    );
}

#[test]
// req:expressions-runtime-005 req:expressions-runtime-007
fn port_invocation_local_callable_shadows_the_global() {
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"reference","name":"add"},
        "args":[]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let local = CompiledExpression::new(expression(json!({"kind":"value","value":"two"})))
            .bind(
                mc,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Pattern::End,
            );
        Environment::new(mc, None, vec![("add".into(), local)])
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!("two")))
        .unwrap();
}

#[test]
// req:expressions-runtime-007
fn port_invocation_completed_value_is_not_a_promise() {
    assert_expr(
        json!({
            "kind":"invocation",
            "expression":{"kind":"reference","name":"add"},
            "args":[{"kind":"value","value":7},{"kind":"value","value":1}]
        }),
        json!(8),
    );
}

#[test]
// req:expressions-runtime-007
fn port_invocation_spreads_an_array_and_rejects_a_non_iterable() {
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"lambda","pattern":{"kind":"then","patterns":[
            {"kind":"variable","name":"a","pattern":{"kind":"any"}},
            {"kind":"variable","name":"b","pattern":{"kind":"any"}},
            {"kind":"variable","name":"c","pattern":{"kind":"any"}}
        ]},
        "expression":{"kind":"array","expressions":[
            {"kind":"arrayElement","expression":{"kind":"reference","name":"a"}},
            {"kind":"arrayElement","expression":{"kind":"reference","name":"b"}},
            {"kind":"arrayElement","expression":{"kind":"reference","name":"c"}}
        ]}},
        "args":[
            {"kind":"value","value":1},
            {"kind":"invocationSpread","expression":{"kind":"reference","name":"rest"}}
        ]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "rest".into(),
                Value::array(mc, vec![Value::Number(2.0), Value::Number(3.0)]),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!([1, 2, 3])))
        .unwrap();
    assert_error(
        json!({
            "kind":"invocation",
            "expression":{"kind":"reference","name":"add"},
            "args":[{"kind":"invocationSpread","expression":{"kind":"value","value":11}}]
        }),
        EvaluationError::NotIterable,
    );
}

#[test]
// req:expressions-runtime-007
fn port_invocation_rejects_a_non_callable_target() {
    assert_error(
        json!({"kind":"invocation","expression":{"kind":"value","value":7},"args":[]}),
        EvaluationError::NotCallable,
    );
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-008
fn port_invocation_add_evaluates_immediate_arguments() {
    assert_expr(
        json!({
            "kind":"invocation",
            "expression":{"kind":"reference","name":"add"},
            "args":[{"kind":"number","value":1},{"kind":"number","value":2}]
        }),
        json!(3),
    );
}

#[test]
// req:expressions-runtime-007
fn port_invocation_calls_a_callable_returned_by_another_call() {
    assert_expr(
        json!({
            "kind":"invocation",
            "expression":{"kind":"invocation","expression":{"kind":"lambda","pattern":{"kind":"end"},
                "expression":{"kind":"lambda","pattern":{"kind":"variable","name":"a","pattern":{"kind":"any"}},
                    "expression":{"kind":"invocation","expression":{"kind":"reference","name":"add"},
                        "args":[{"kind":"reference","name":"a"},{"kind":"reference","name":"a"}]}}},
                "args":[]},
            "args":[{"kind":"number","value":4}]
        }),
        json!(8),
    );
}

#[test]
// req:expressions-runtime-007
fn port_lambda_zero_argument_body_reads_the_captured_binding() {
    let ast = expression(json!({
        "kind":"invocation",
        "args":[],
        "expression":{"kind":"lambda",
            "pattern":{"kind":"not","pattern":{"kind":"any"}},
            "expression":{"kind":"reference","name":"a"}}
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("a".into(), Value::Number(11.0))])
    });
    let result = evaluation.finish().unwrap();
    assert!(
        evaluation
            .read(&result, |value| is_number(value, 11.0))
            .unwrap()
    );
}

#[test]
// req:expressions-runtime-007
fn port_lambda_binds_a_matched_argument() {
    assert_expr(
        json!({
            "kind":"invocation",
            "args":[{"kind":"value","value":7}],
            "expression":{"kind":"lambda",
                "pattern":{"kind":"then","patterns":[
                    {"kind":"variable","name":"a","pattern":{"kind":"any"}}
                ]},
                "expression":{"kind":"reference","name":"a"}}
        }),
        json!(7),
    );
}

#[test]
// req:expressions-runtime-007
fn port_lambda_value_takes_the_evaluation_origin_and_returns_its_argument() {
    let mut evaluation = Evaluation::new(expression(json!({
        "kind":"lambda",
        "pattern":{"kind":"any"},
        "expression":{"kind":"reference","name":"_"}
    })));
    let result = evaluation.finish().unwrap();
    assert_eq!(
        evaluation
            .read_with_provenance(&result, |value| value.origin())
            .unwrap(),
        Some(Origin { start: 0, end: 0 })
    );

    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"lambda","pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"_"}},
        "args":[{"kind":"reference","name":"item"}]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(
            mc,
            None,
            vec![(
                "item".into(),
                Value::Number(1.0).wrap(mc, Origin { start: 3, end: 4 }),
            )],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        assert!(value.same_wrapper(state.environment.get("item").unwrap()));
    });
}

#[test]
// req:expressions-runtime-007
fn port_lambda_argument_mismatch_and_duplicate_parameter_are_errors() {
    assert_error(
        json!({
            "kind":"invocation",
            "expression":{"kind":"lambda",
                "pattern":{"kind":"type","type":"string"},
                "expression":{"kind":"reference","name":"_"}},
            "args":[{"kind":"number","value":1}]
        }),
        EvaluationError::LambdaArguments,
    );
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"lambda",
            "pattern":{"kind":"variable","name":"a","pattern":{"kind":"any"}},
            "expression":{"kind":"reference","name":"a"}},
        "args":[{"kind":"number","value":2}]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        Environment::new(mc, None, vec![("a".into(), Value::Number(1.0))])
    });
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::Pattern(PatternError::DuplicateVariable("a".into()))
    );
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-010
fn port_func_without_subject_resolves_this_to_the_argument_match() {
    let mut evaluation = Evaluation::new(expression(json!({
        "kind":"invocation",
        "args":[],
        "expression":{"kind":"lambda","pattern":{"kind":"end"},
            "expression":{"kind":"reference","name":"this"}}
    })));
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        let value = *state.external.fetch(&result.0);
        let Value::Match(matched) = value.raw() else {
            panic!("expected match, got {}", value.runtime_type());
        };
        assert_eq!(matched.kind, MatchKind::Ok);
    });
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-010
fn port_func_subject_rebinds_this() {
    let ast = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"reference","name":"identity"},
        "args":[]
    }));
    let mut evaluation = Evaluation::with_environment(ast, |mc| {
        let subject = Value::object(mc, vec![("name".into(), Value::string(mc, "Example"))]);
        let identity =
            CompiledExpression::new(expression(json!({"kind":"reference","name":"this"})))
                .bind_subject(
                    mc,
                    Environment::new(mc, None, vec![]),
                    Origin { start: 0, end: 0 },
                    Pattern::End,
                    subject,
                );
        Environment::new(mc, None, vec![("identity".into(), identity)])
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!({"name":"Example"})))
        .unwrap();
}

#[test]
// req:expressions-runtime-007
fn port_func_extra_argument_does_not_match_end() {
    assert_error(
        json!({
            "kind":"invocation",
            "expression":{"kind":"lambda","pattern":{"kind":"end"},
                "expression":{"kind":"reference","name":"this"}},
            "args":[{"kind":"value","value":"unexpected-extra-argument"}]
        }),
        EvaluationError::LambdaArguments,
    );
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-005
fn port_func_parameters_do_not_see_caller_variables() {
    let echo = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"reference","name":"echo"},
        "args":[{"kind":"value","value":"arg"}]
    }));
    let mut evaluation = Evaluation::with_environment(echo, |mc| {
        let callable = CompiledExpression::new(expression(json!({"kind":"reference","name":"x"})))
            .bind(
                mc,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Pattern::Variable {
                    name: "x".into(),
                    pattern: Box::new(Pattern::Any),
                },
            );
        Environment::new(
            mc,
            None,
            vec![
                ("echo".into(), callable),
                ("x".into(), Value::string(mc, "caller")),
                ("y".into(), Value::string(mc, "hidden")),
            ],
        )
    });
    let result = evaluation.finish().unwrap();
    evaluation
        .read(&result, |value| expect(value, &json!("arg")))
        .unwrap();

    let leak = expression(json!({
        "kind":"invocation",
        "expression":{"kind":"reference","name":"leak"},
        "args":[{"kind":"value","value":"arg"}]
    }));
    let mut evaluation = Evaluation::with_environment(leak, |mc| {
        let callable = CompiledExpression::new(expression(json!({"kind":"reference","name":"y"})))
            .bind(
                mc,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Pattern::Variable {
                    name: "x".into(),
                    pattern: Box::new(Pattern::Any),
                },
            );
        Environment::new(
            mc,
            None,
            vec![
                ("leak".into(), callable),
                ("y".into(), Value::string(mc, "hidden")),
            ],
        )
    });
    assert_eq!(
        evaluation.finish().unwrap_err(),
        EvaluationError::UnknownReference("y".into())
    );
}

#[test]
// req:expressions-runtime-007 req:expressions-runtime-005
fn port_func_body_resolves_a_func_from_its_declaring_module() {
    let (url, compiled) = compiled_module(json!({
        "imports": [],
        "exports": [],
        "rules": [],
        "funcs": [
            {
                "name": "Helper",
                "pattern": {"kind": "end"},
                "expression": {"kind": "reference", "name": "this"}
            },
            {
                "name": "Outer",
                "pattern": {"kind": "end"},
                "expression": {
                    "kind": "invocation",
                    "expression": {"kind": "reference", "name": "Helper"},
                    "args": []
                }
            }
        ],
        "decorators": []
    }));
    let mut evaluation = Evaluation::with_environment(
        expression(json!({
            "kind":"invocation",
            "expression":{"kind":"reference","name":"Outer"},
            "args":[]
        })),
        |mc| {
            let module = crate::module::ModuleBindings::new(mc, &compiled)
                .unwrap()
                .environment(&url)
                .unwrap();
            Environment::new(
                mc,
                None,
                vec![("Outer".into(), module.get("Outer").unwrap())],
            )
        },
    );
    let result = evaluation.finish().unwrap();
    evaluation.arena.mutate(|_, state| {
        assert!(state.environment.get("Helper").is_none());
        let value = *state.external.fetch(&result.0);
        let Value::Match(matched) = value.raw() else {
            panic!("expected match, got {}", value.runtime_type());
        };
        assert_eq!(matched.kind, MatchKind::Ok);
        assert!(matched.environment.get("Helper").is_some());
    });
}

#[test]
// req:expressions-runtime-007
fn port_func_duplicate_parameter_is_raised() {
    assert_error(
        json!({
            "kind":"invocation",
            "expression":{"kind":"lambda","pattern":{"kind":"then","patterns":[
                {"kind":"variable","name":"a","pattern":{"kind":"any"}},
                {"kind":"variable","name":"a","pattern":{"kind":"any"}}
            ]},
            "expression":{"kind":"reference","name":"a"}},
            "args":[{"kind":"number","value":1},{"kind":"number","value":2}]
        }),
        EvaluationError::Pattern(PatternError::DuplicateVariable("a".into())),
    );
}

#[test]
// req:expressions-runtime-002 req:expressions-runtime-007
fn port_native_and_unknown_expression_kinds_fail_to_decode() {
    for kind in ["native", "unknown"] {
        let error = serde_json::from_value::<crate::expression::Expression>(
            json!({"kind": kind, "fn": null}),
        )
        .unwrap_err()
        .to_string();
        assert!(
            error.contains(kind) || error.contains("unknown variant"),
            "{kind}: {error}"
        );
    }
}

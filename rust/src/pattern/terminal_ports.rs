#![allow(unused_imports)]
use super::*;
use crate::globals::NativeGlobal;
use num_bigint::BigInt;
use serde_json::json;
use time::OffsetDateTime;

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

fn value_source(value: serde_json::Value) -> ValueSource {
    ValueSource::Literal {
        value: LiteralValue::Present(value.into()),
    }
}

fn variable_source(name: &str) -> ValueSource {
    ValueSource::Variable { name: name.into() }
}

fn complete<'gc>(
    mc: &Mutation<'gc>,
    execution: &mut PatternExecution<'gc>,
) -> Gc<'gc, PatternMatch<'gc>> {
    while !execution.step(mc).expect("pattern step") {}
    execution.result().expect("pattern result")
}

fn same_outcome<'gc>(actual: Value<'gc>, expected: Value<'gc>) -> bool {
    match (actual.raw(), expected.raw()) {
        (Value::Number(left), Value::Number(right)) if left.is_nan() && right.is_nan() => true,
        _ => actual.strict_eq(expected),
    }
}

fn assert_carries<'gc>(mc: &Mutation<'gc>, pattern: Pattern, item: Value<'gc>) {
    let mut execution =
        PatternExecution::new(mc, pattern, vec![item], Environment::new(mc, None, vec![]));
    let result = complete(mc, &mut execution);
    assert_eq!(result.kind, MatchKind::Ok);
    assert_eq!(result.end, 1);
    assert!(result.value.same_wrapper(item));
}

fn regexp(source: &str) -> Pattern {
    Pattern::Regexp {
        pattern: RegExpSpec::Source(source.into()),
    }
}

fn includes(values: Vec<ValueSource>) -> Pattern {
    Pattern::Includes { values }
}

fn between(left: Option<serde_json::Value>, right: Option<serde_json::Value>) -> Pattern {
    Pattern::Between {
        left: left.map(value_source),
        right: right.map(value_source),
    }
}

fn assert_error<'gc>(
    mc: &Mutation<'gc>,
    pattern: Pattern,
    input: Vec<Value<'gc>>,
    environment: Environment<'gc>,
    expected: PatternError,
    message: &str,
) {
    let mut execution = PatternExecution::new(mc, pattern, input, environment);
    let error = execution.step(mc).unwrap_err();
    assert_eq!(error, expected);
    assert_eq!(error.to_string(), message);
    assert!(execution.result().is_none());
}

#[test]
// req:equal-001 req:equal-002 req:equal-003 req:equal-005
fn port_equal_matches_one_string_item() {
    assert_item(literal(json!("a")), json!("a"), MatchKind::Ok, 1, "a");
}

#[test]
// req:equal-001 req:equal-002 req:equal-003 req:equal-005
fn port_equal_matches_one_number_item() {
    assert_item(literal(json!(7)), json!([7]), MatchKind::Ok, 1, "7");
}

#[test]
// req:equal-001 req:equal-002 req:equal-004 req:equal-005
fn port_equal_fails_without_consuming_a_different_number() {
    assert_item(literal(json!(7)), json!([11]), MatchKind::Fail, 0, "");
}

#[test]
// req:equal-002 req:equal-003 req:equal-006
fn port_equal_literal_value_source_matches_the_declared_value() {
    assert_item(literal(json!("a")), json!("a"), MatchKind::Ok, 1, "a");
}

#[test]
// req:equal-002 req:equal-003 req:equal-006
fn port_equal_matches_a_bound_variable() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: variable_source("x"),
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![("x".into(), Value::string(mc, "a"))]),
        );
        let result = complete(mc, &mut execution);
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(item_text(result.value), "a");
    });
}

#[test]
// req:equal-006
fn port_equal_reports_an_unknown_value_reference() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: variable_source("x"),
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![]),
        );
        let error = execution.step(mc).unwrap_err();
        assert_eq!(error, PatternError::UnknownValueReference("x".into()));
        assert_eq!(error.to_string(), "Unknown value reference $x");
        assert!(execution.result().is_none());
    });
}

#[test]
// req:equal-002 req:equal-003
fn port_equal_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "a").wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(mc, literal(json!("a")), item);
    });
}

#[test]
// req:type-001
fn port_type_matches_one_item_by_runtime_type() {
    uffda_heap::rootless_mutate(|mc| {
        let successes = [
            (Value::bigint(mc, BigInt::from(1)), RuntimeType::BigInt),
            (Value::Boolean(true), RuntimeType::Boolean),
            (Value::Boolean(false), RuntimeType::Boolean),
            (Value::Native(NativeGlobal::Id), RuntimeType::Function),
            (Value::Number(7.0), RuntimeType::Number),
            (Value::Number(7.11), RuntimeType::Number),
            (Value::Number(f64::NAN), RuntimeType::Number),
            (Value::object(mc, vec![]), RuntimeType::Object),
            (Value::string(mc, "a"), RuntimeType::String),
            (
                Value::Symbol(Gc::new(mc, "symbol".into())),
                RuntimeType::Symbol,
            ),
            (Value::Undefined, RuntimeType::Undefined),
            (Value::Null, RuntimeType::Null),
            (Value::map(mc, vec![]), RuntimeType::Map),
            (Value::set(mc, vec![]), RuntimeType::Set),
            (
                Value::date(mc, OffsetDateTime::UNIX_EPOCH),
                RuntimeType::Date,
            ),
            (
                Value::error(mc, "Error".into(), "".into(), None, None),
                RuntimeType::Error,
            ),
        ];
        for (input, expected) in successes {
            let mut execution = PatternExecution::new(
                mc,
                Pattern::Type { expected },
                vec![input],
                Environment::new(mc, None, vec![]),
            );
            let result = complete(mc, &mut execution);
            assert_eq!(result.kind, MatchKind::Ok, "{expected}");
            assert_eq!(result.end, 1, "{expected}");
            assert_eq!(result.value.runtime_type(), expected);
            assert!(same_outcome(result.value, input), "{expected}");
        }

        let failures = [
            (Value::Null, RuntimeType::BigInt),
            (Value::Null, RuntimeType::Boolean),
            (Value::Null, RuntimeType::Function),
            (Value::Null, RuntimeType::Number),
            (Value::Undefined, RuntimeType::Object),
            (Value::Null, RuntimeType::String),
            (Value::Null, RuntimeType::Symbol),
            (Value::Null, RuntimeType::Undefined),
            (Value::Undefined, RuntimeType::Null),
            (Value::Null, RuntimeType::Map),
            (Value::Null, RuntimeType::Set),
            (Value::Null, RuntimeType::Date),
            (Value::Null, RuntimeType::Error),
        ];
        for (input, expected) in failures {
            let mut execution = PatternExecution::new(
                mc,
                Pattern::Type { expected },
                vec![input],
                Environment::new(mc, None, vec![]),
            );
            let result = complete(mc, &mut execution);
            assert_eq!(result.kind, MatchKind::Fail, "{expected}");
            assert_eq!(result.end, 0, "{expected}");
        }
    });
}

#[test]
// req:type-001
fn port_type_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::Number(7.0).wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(
            mc,
            Pattern::Type {
                expected: RuntimeType::Number,
            },
            item,
        );
    });
}

#[test]
// req:regexp-001
fn port_regexp_matches_one_string_item() {
    assert_item(regexp("a"), json!("a"), MatchKind::Ok, 1, "a");
}

#[test]
// req:regexp-001
fn port_regexp_reports_a_type_error_for_a_non_string() {
    uffda_heap::rootless_mutate(|mc| {
        assert_error(
            mc,
            regexp("a"),
            vec![Value::Number(1.0)],
            Environment::new(mc, None, vec![]),
            PatternError::TypeError("expected value to be a string but got number".into()),
            "expected value to be a string but got number",
        );
    });
}

#[test]
// req:regexp-001
fn port_regexp_consumes_one_matching_item_and_leaves_the_rest() {
    assert_item(regexp("a"), json!("aa"), MatchKind::Ok, 1, "a");
}

#[test]
// req:regexp-001
fn port_regexp_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "7").wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(mc, regexp(r"\d"), item);
    });
}

#[test]
// req:includes-001
fn port_includes_matches_a_declared_value() {
    assert_item(
        includes(vec![value_source(json!("x"))]),
        json!("x"),
        MatchKind::Ok,
        1,
        "x",
    );
}

#[test]
// req:includes-001
fn port_includes_matches_any_declared_value() {
    assert_item(
        includes(vec![
            value_source(json!("x")),
            value_source(json!("y")),
            value_source(json!("z")),
        ]),
        json!("y"),
        MatchKind::Ok,
        1,
        "y",
    );
}

#[test]
// req:includes-001
fn port_includes_fails_without_consuming_a_missing_value() {
    assert_item(
        includes(vec![
            value_source(json!("x")),
            value_source(json!("y")),
            value_source(json!("z")),
        ]),
        json!("a"),
        MatchKind::Fail,
        0,
        "",
    );
}

#[test]
// req:includes-001
fn port_includes_matches_a_bound_variable() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            includes(vec![variable_source("a"), value_source(json!("y"))]),
            vec![Value::string(mc, "x")],
            Environment::new(mc, None, vec![("a".into(), Value::string(mc, "x"))]),
        );
        let result = complete(mc, &mut execution);
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(item_text(result.value), "x");
    });
}

#[test]
// req:includes-001
fn port_includes_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "b").wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(
            mc,
            includes(vec![value_source(json!("a")), value_source(json!("b"))]),
            item,
        );
    });
}

#[test]
// req:equal-002 req:equal-003 req:equal-006
fn port_value_source_literal_resolves_to_its_declared_value() {
    assert_item(literal(json!(7)), json!([7]), MatchKind::Ok, 1, "7");
}

#[test]
// req:equal-002 req:equal-003 req:equal-006
fn port_value_source_reads_a_scope_variable() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: variable_source("n"),
            },
            vec![Value::Number(3.0)],
            Environment::new(mc, None, vec![("n".into(), Value::Number(3.0))]),
        );
        let result = complete(mc, &mut execution);
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(item_text(result.value), "3");
    });
}

#[test]
// req:equal-006
fn port_value_source_errors_when_the_variable_is_unbound() {
    uffda_heap::rootless_mutate(|mc| {
        assert_error(
            mc,
            Pattern::Equal {
                value: variable_source("missing"),
            },
            vec![],
            Environment::new(mc, None, vec![]),
            PatternError::UnknownValueReference("missing".into()),
            "Unknown value reference $missing",
        );
    });
}

#[test]
// req:equal-002 req:equal-003 req:equal-006
fn port_value_source_compares_a_variables_raw_value_and_carries_the_input() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "a").wrap(mc, Origin { start: 4, end: 5 });
        let bound = Value::string(mc, "a").wrap(mc, Origin { start: 0, end: 1 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Equal {
                value: variable_source("x"),
            },
            vec![item],
            Environment::new(mc, None, vec![("x".into(), bound)]),
        );
        let result = complete(mc, &mut execution);
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.value.same_wrapper(item));
        assert!(!result.value.same_wrapper(bound));
    });
}

#[test]
// req:between-001
fn port_between_matches_numbers_and_strings_inside_inclusive_bounds() {
    assert_item(
        between(Some(json!(0)), Some(json!(2))),
        json!([1]),
        MatchKind::Ok,
        1,
        "1",
    );
    assert_item(
        between(Some(json!(0)), Some(json!(0))),
        json!([0]),
        MatchKind::Ok,
        1,
        "0",
    );
    assert_item(
        between(Some(json!(0)), Some(json!(1))),
        json!([1]),
        MatchKind::Ok,
        1,
        "1",
    );
    assert_item(
        between(Some(json!("a")), Some(json!("a"))),
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
    assert_item(
        between(Some(json!("a")), Some(json!("b"))),
        json!("b"),
        MatchKind::Ok,
        1,
        "b",
    );
    assert_item(
        between(Some(json!("a")), Some(json!("c"))),
        json!("b"),
        MatchKind::Ok,
        1,
        "b",
    );
}

#[test]
// req:between-001
fn port_between_fails_without_consuming_an_out_of_range_or_incomparable_value() {
    assert_item(
        between(Some(json!("a")), Some(json!("b"))),
        json!("v"),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!(0)), Some(json!(1))),
        json!([2]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!(0)), Some(json!("a"))),
        json!([0]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!("a")), Some(json!(0))),
        json!([0]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!(true)), Some(json!(false))),
        json!([true]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!({"value": 0})), Some(json!({"value": 0}))),
        json!([{"value": 1}]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!({})), Some(json!({"value": 0}))),
        json!([{"value": 1}]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(Some(json!({"value": 0})), Some(json!({}))),
        json!([{"value": 1}]),
        MatchKind::Fail,
        0,
        "",
    );
}

#[test]
// req:between-001
fn port_between_reports_null_undefined_and_missing_bounds() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        assert_error(
            mc,
            between(Some(json!(0)), Some(json!(0))),
            vec![Value::Undefined],
            environment,
            PatternError::NullValue,
            "expected value to be non-null",
        );
        assert_error(
            mc,
            between(Some(json!(0)), Some(json!(0))),
            vec![Value::Null],
            environment,
            PatternError::NullValue,
            "expected value to be non-null",
        );
        assert_error(
            mc,
            between(None, None),
            vec![Value::Number(1.0)],
            environment,
            PatternError::InvalidBound(
                "between requires at least one bound (L..R, L.., or ..R)".into(),
            ),
            "between requires at least one bound (L..R, L.., or ..R)",
        );
    });
}

#[test]
// req:between-001
fn port_between_resolves_variable_bounds() {
    uffda_heap::rootless_mutate(|mc| {
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Between {
                left: Some(variable_source("lo")),
                right: Some(variable_source("hi")),
            },
            vec![Value::Number(1.0)],
            Environment::new(
                mc,
                None,
                vec![
                    ("lo".into(), Value::Number(0.0)),
                    ("hi".into(), Value::Number(2.0)),
                ],
            ),
        );
        let result = complete(mc, &mut execution);
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert_eq!(item_text(result.value), "1");
    });
}

#[test]
// req:between-001
fn port_between_matches_open_upper_and_lower_bounds() {
    assert_item(
        between(Some(json!(2)), None),
        json!([5]),
        MatchKind::Ok,
        1,
        "5",
    );
    assert_item(
        between(Some(json!(2)), None),
        json!([1]),
        MatchKind::Fail,
        0,
        "",
    );
    assert_item(
        between(None, Some(json!(2))),
        json!([1]),
        MatchKind::Ok,
        1,
        "1",
    );
    assert_item(
        between(None, Some(json!(2))),
        json!([3]),
        MatchKind::Fail,
        0,
        "",
    );
}

#[test]
// req:between-001
fn port_between_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::Number(5.0).wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(mc, between(Some(json!(1)), Some(json!(9))), item);
    });
}

#[test]
// req:character-001
fn port_character_matches_declared_unicode_classes() {
    let cases = [
        ("L", "a", MatchKind::Ok, 1, "a"),
        ("L", "1", MatchKind::Fail, 0, ""),
        ("Lu", "A", MatchKind::Ok, 1, "A"),
        ("Ll", "z", MatchKind::Ok, 1, "z"),
        ("Lt", "ǅ", MatchKind::Ok, 1, "ǅ"),
        ("Lm", "ᶭ", MatchKind::Ok, 1, "ᶭ"),
        ("Lo", "ǂ", MatchKind::Ok, 1, "ǂ"),
        ("M", "⃟", MatchKind::Ok, 1, "⃟"),
        ("N", "7", MatchKind::Ok, 1, "7"),
        ("Nd", "0", MatchKind::Ok, 1, "0"),
        ("Nl", "Ⅳ", MatchKind::Ok, 1, "Ⅳ"),
        ("No", "¼", MatchKind::Ok, 1, "¼"),
        ("S", "+", MatchKind::Ok, 1, "+"),
        ("Sm", "+", MatchKind::Ok, 1, "+"),
        ("Sc", "$", MatchKind::Ok, 1, "$"),
        ("Sk", "¨", MatchKind::Ok, 1, "¨"),
        ("So", "֍", MatchKind::Ok, 1, "֍"),
        ("P", ".", MatchKind::Ok, 1, "."),
        ("Ps", "(", MatchKind::Ok, 1, "("),
        ("Pe", ")", MatchKind::Ok, 1, ")"),
        ("Pd", "-", MatchKind::Ok, 1, "-"),
        ("Pi", "«", MatchKind::Ok, 1, "«"),
        ("Pc", "﹍", MatchKind::Ok, 1, "﹍"),
        ("Pf", "»", MatchKind::Ok, 1, "»"),
        ("Po", "!", MatchKind::Ok, 1, "!"),
        ("Z", " ", MatchKind::Ok, 1, " "),
        ("Zs", " ", MatchKind::Ok, 1, " "),
        ("Zl", "\u{2028}", MatchKind::Ok, 1, "\u{2028}"),
        ("Zp", "\u{2029}", MatchKind::Ok, 1, "\u{2029}"),
        ("C", "\u{0}", MatchKind::Ok, 1, "\u{0}"),
        ("Cc", "\u{0}", MatchKind::Ok, 1, "\u{0}"),
        ("Cf", "\u{feff}", MatchKind::Ok, 1, "\u{feff}"),
    ];
    for (class, text, kind, end, value) in cases {
        let mut runtime = crate::runtime::Runtime::for_pattern(
            Pattern::Character {
                character_class: class.into(),
            },
            json!(text),
            crate::runtime::InputMode::Iterable,
        )
        .unwrap();
        runtime.run().unwrap();
        runtime.read(|execution| {
            let result = execution.result().unwrap();
            assert_eq!(result.kind, kind, "{class} {text:?}");
            assert_eq!(result.end, end, "{class} {text:?}");
            if kind != MatchKind::Fail {
                assert_eq!(item_text(result.value), value, "{class}");
            }
        });
    }
}

#[test]
// req:character-001
fn port_character_reports_an_unknown_class() {
    uffda_heap::rootless_mutate(|mc| {
        assert_error(
            mc,
            Pattern::Character {
                character_class: "Bogus".into(),
            },
            vec![Value::string(mc, "a")],
            Environment::new(mc, None, vec![]),
            PatternError::InvalidArgument("unknown character class Bogus".into()),
            "unknown character class Bogus",
        );
    });
}

#[test]
// req:character-001
fn port_character_carries_the_wrapped_input_item() {
    uffda_heap::rootless_mutate(|mc| {
        let item = Value::string(mc, "a").wrap(mc, Origin { start: 4, end: 5 });
        assert_carries(
            mc,
            Pattern::Character {
                character_class: "L".into(),
            },
            item,
        );
    });
}

#![allow(unused_imports)]
use super::*;
use crate::coercion::{StringCoercionError, string_text};
use crate::pattern::{PatternError, PatternExecution, PatternProgram};
use crate::provenance::{Origin, concatenate};
use crate::resolver::{Resolver, decode_declaration};
use input::{DiagnosticSegment, InputPosition, PathSegment};
use serde_json::{Value as Json, json};
use std::rc::Rc;

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
    let url = Url::parse("file:///engine-ports.json").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(&url, &module.to_string()).unwrap(),
    );
    let compiled =
        Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
    (compiled, url)
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

fn pattern_of(value: Json) -> Pattern {
    serde_json::from_value(value).unwrap()
}

fn run_text(rules: Json, entry: &str, input: &str) -> Runtime {
    let (compiled, url) = graph(rules, entry);
    let mut runtime =
        Runtime::with_mode(compiled, &url, None, json!(input), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime
}

fn parsed_result(runtime: &mut Runtime) -> Json {
    serde_json::from_str(&runtime.serialize_result().unwrap().unwrap()).unwrap()
}

fn until_semicolon() -> Json {
    json!({
        "kind":"quantifier",
        "min":{"kind":"value.literal","value":1},
        "pattern":{"kind":"then","patterns":[
            {"kind":"not","pattern":equal(json!(";"))},
            {"kind":"any"}
        ]}
    })
}

fn statement_rules() -> Json {
    json!([
        rule(
            "Module",
            json!({"kind":"then","patterns":[
                {"kind":"quantifier","pattern":{"kind":"then","patterns":[
                    reference("Stmt"),
                    equal(json!(";"))
                ]}},
                {"kind":"end"}
            ]})
        ),
        rule(
            "Stmt",
            json!({
                "kind":"recover",
                "pattern":{"kind":"then","patterns":[equal(json!("a")), equal(json!("b"))]},
                "skip": until_semicolon()
            })
        )
    ])
}

fn recovery_spans(runtime: &Runtime) -> Vec<(usize, usize)> {
    runtime.read(|execution| {
        execution
            .recoveries()
            .iter()
            .map(|recovery| (recovery.origin.start, recovery.origin.end))
            .collect()
    })
}

fn compare_paths(left: &[DiagnosticSegment], right: &[DiagnosticSegment]) -> i8 {
    match left.cmp(right) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    }
}

fn index(value: usize) -> DiagnosticSegment {
    DiagnosticSegment::Index(value)
}

fn key(value: &str) -> DiagnosticSegment {
    DiagnosticSegment::Key(value.into())
}

#[test]
// req:runtime-core-004
fn engine_port_path_orders_indices_before_keys_and_formats_diagnostic_positions() {
    let comparisons: &[(&[DiagnosticSegment], &[DiagnosticSegment], i8)] = &[
        (&[index(0)], &[index(0)], 0),
        (&[index(1)], &[index(0)], 1),
        (&[index(0)], &[index(1)], -1),
        (&[index(0), index(0)], &[index(0), index(0)], 0),
        (&[index(0), index(0)], &[index(0), index(1)], -1),
        (&[index(0), index(0)], &[index(1), index(0)], -1),
        (&[index(1), index(0)], &[index(0), index(0)], 1),
        (&[index(1), index(0)], &[index(1), index(1)], -1),
        (&[index(0), index(1)], &[index(1), index(0)], -1),
        (&[key("x")], &[key("y")], -1),
        (&[key("y")], &[key("x")], 1),
        (&[key("x"), key("x")], &[key("x")], 1),
        (&[key("x")], &[key("x"), key("x")], -1),
        (&[key("y"), key("y")], &[key("y")], 1),
        (&[key("x"), key("x")], &[key("y")], -1),
        (&[index(0)], &[key("x")], -1),
        (&[key("x")], &[index(0)], 1),
    ];
    for (left, right, expected) in comparisons {
        assert_eq!(
            compare_paths(left, right),
            *expected,
            "{left:?} <=> {right:?}"
        );
    }

    let numeric = InputPosition {
        domain: 1,
        path: vec![PathSegment::Item(0), PathSegment::Item(1)],
        cursor: 2,
    };
    let mixed = InputPosition {
        domain: 1,
        path: vec![
            PathSegment::Item(0),
            PathSegment::Key("x".into()),
            PathSegment::Item(1),
            PathSegment::Key("y".into()),
            PathSegment::Item(2),
        ],
        cursor: 0,
    };
    assert_eq!(numeric.to_string(), "[0].[1].[2]");
    assert_eq!(mixed.to_string(), "[0].\"x\".[1].\"y\".[2].[0]");
    assert_eq!(numeric.to_string(), numeric.to_string());
    assert_eq!(numeric, numeric.clone());
}

#[test]
// req:runtime-core-003 req:runtime-core-014
fn engine_port_input_items_distinguish_scalar_iterable_and_character_origins() {
    uffda_heap::rootless_mutate(|mc| {
        let empty = runtime_input(mc, json!([]), InputMode::Iterable).unwrap();
        assert!(empty.is_empty());
        let pending = runtime_input(mc, json!([1, 2, 3]), InputMode::Iterable).unwrap();
        assert_eq!(pending.len(), 3);
        assert!(pending[0].strict_eq(Value::Number(1.0)));

        let letters = runtime_input(mc, json!("xyz"), InputMode::Iterable).unwrap();
        assert_eq!(letters.len(), 3);
        assert_eq!(string_text(letters[0]).unwrap(), "x");
        assert_eq!(letters[0].origin(), Some(Origin { start: 0, end: 1 }));
        assert_eq!(letters[2].origin(), Some(Origin { start: 2, end: 3 }));
        assert!(
            runtime_input(mc, json!("xyz"), InputMode::Iterable).unwrap()[2]
                .origin()
                .is_some()
        );

        let scalar = runtime_input(mc, json!("abc"), InputMode::Scalar).unwrap();
        assert_eq!(scalar.len(), 1);
        assert_eq!(string_text(scalar[0]).unwrap(), "abc");
        assert_eq!(scalar[0].origin(), Some(Origin { start: 0, end: 3 }));

        let hello = runtime_input(mc, json!("héllo"), InputMode::Scalar).unwrap();
        assert_eq!(hello[0].origin(), Some(Origin { start: 0, end: 5 }));
        assert_eq!(hello[0].char_origin(0), Some(Origin { start: 0, end: 1 }));

        let array = runtime_input(mc, json!([1, 2]), InputMode::Scalar).unwrap();
        assert_eq!(array[0].origin(), Some(Origin { start: 0, end: 1 }));

        assert!(matches!(
            runtime_input(mc, json!(7), InputMode::Iterable),
            Err(RuntimeError::Module(message))
                if message == "input is not iterable"
        ));

        let carried = Value::string(mc, "abc").wrap(mc, Origin { start: 7, end: 10 });
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Any,
            vec![carried],
            Environment::new(mc, None, vec![]),
        );
        while !execution.step(mc).unwrap() {}
        let matched = execution.result().unwrap();
        assert!(matched.value.same_wrapper(carried));
        assert_eq!(matched.origin, Origin { start: 7, end: 10 });
    });
}

#[test]
// req:tokenizer-runtime-011 req:runtime-core-004 req:tokenizer-runtime-007
fn engine_port_source_spans_follow_item_origins_including_unread_and_eof() {
    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let tokens = vec![
            Value::string(mc, "import").wrap(mc, Origin { start: 0, end: 6 }),
            Value::string(mc, "\"").wrap(mc, Origin { start: 7, end: 8 }),
            Value::string(mc, ".").wrap(mc, Origin { start: 8, end: 9 }),
        ];
        let any_then_fail = || Pattern::Then {
            patterns: vec![
                Pattern::Any,
                Pattern::Equal {
                    value: crate::pattern::ValueSource::Literal {
                        value: crate::pattern::LiteralValue::Present(json!("no").into()),
                    },
                },
            ],
        };
        let mut buffered = PatternExecution::new(mc, any_then_fail(), tokens.clone(), environment);
        assert!(buffered.step(mc).is_ok());
        while !buffered.step(mc).unwrap() {}
        let failed = buffered.result().unwrap();
        assert_eq!(failed.kind, MatchKind::Fail);
        let at_quote = failed
            .children
            .iter()
            .find(|child| child.pattern_kind == PatternKind::Equal)
            .unwrap();
        assert_eq!(at_quote.origin, Origin { start: 7, end: 7 });

        let mut unread = PatternExecution::new(mc, any_then_fail(), vec![tokens[0]], environment);
        while !unread.step(mc).unwrap() {}
        let unread_result = unread.result().unwrap();
        let unread_equal = unread_result
            .children
            .iter()
            .find(|child| child.pattern_kind == PatternKind::Equal)
            .unwrap();
        assert_eq!(unread_equal.origin, Origin { start: 6, end: 6 });

        let word = Value::string(mc, "abc").wrap(mc, Origin { start: 8, end: 11 });
        let mut at_end = PatternExecution::new(
            mc,
            Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::End],
            },
            vec![word],
            environment,
        );
        while !at_end.step(mc).unwrap() {}
        let ended = at_end.result().unwrap();
        assert_eq!(ended.kind, MatchKind::Ok);
        assert_eq!(ended.children[1].origin, Origin { start: 11, end: 11 });

        let mut fresh = PatternExecution::compiled(
            mc,
            PatternProgram::compile(Pattern::End),
            vec![],
            environment,
            4,
        );
        while !fresh.step(mc).unwrap() {}
        assert_eq!(fresh.result().unwrap().origin, Origin { start: 4, end: 4 });

        let chars = runtime_input(mc, json!("ab"), InputMode::Iterable).unwrap();
        let mut root = PatternExecution::new(
            mc,
            Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any],
            },
            chars,
            environment,
        );
        while !root.step(mc).unwrap() {}
        assert_eq!(root.result().unwrap().origin, Origin { start: 0, end: 2 });

        let scalar = runtime_input(mc, json!("abc"), InputMode::Scalar).unwrap();
        assert_eq!(scalar[0].char_origin(1), Some(Origin { start: 1, end: 2 }));

        let newline = vec![
            Value::string(mc, "a").wrap(mc, Origin { start: 0, end: 1 }),
            Value::string(mc, "\n").wrap(mc, Origin { start: 1, end: 3 }),
            Value::string(mc, "b").wrap(mc, Origin { start: 3, end: 4 }),
        ];
        let mut spanned = PatternExecution::new(
            mc,
            Pattern::Then {
                patterns: vec![Pattern::Any, Pattern::Any],
            },
            newline,
            environment,
        );
        while !spanned.step(mc).unwrap() {}
        assert_eq!(
            spanned.result().unwrap().origin,
            Origin { start: 0, end: 3 }
        );
    });
}

#[test]
// req:runtime-strings-002 req:runtime-core-012 req:into-001
fn engine_port_wrapped_values_keep_origins_identity_and_reject_composites() {
    uffda_heap::rootless_mutate(|mc| {
        let inner = Value::string(mc, "a").wrap(mc, Origin { start: 0, end: 1 });
        assert!(inner.same_wrapper(inner.wrap(mc, Origin { start: 5, end: 6 })));
        let number = Value::Number(42.0).wrap(mc, Origin { start: 3, end: 4 });
        assert_eq!(number.origin(), Some(Origin { start: 3, end: 4 }));
        assert!(number.raw().strict_eq(Value::Number(42.0)));
        assert!(string_text(Value::string(mc, "plain")).unwrap() == "plain");

        let nested_number = Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 });
        let items = Value::array(mc, vec![nested_number, Value::Number(2.0)])
            .wrap(mc, Origin { start: 0, end: 1 });
        let wrapped = Value::object(
            mc,
            vec![
                (
                    "kind".into(),
                    Value::string(mc, "word").wrap(mc, Origin { start: 0, end: 1 }),
                ),
                ("items".into(), items),
            ],
        )
        .wrap(mc, Origin { start: 0, end: 1 });
        let unwrapped = wrapped.unwrap_deep(mc);
        let Value::Object(properties) = unwrapped else {
            panic!("object");
        };
        let Value::String(kind) = properties.borrow().get("kind").unwrap().raw() else {
            panic!("kind");
        };
        assert_eq!(&*kind, "word");
        let Value::Array(unwrapped_items) = properties.borrow().get("items").unwrap().raw() else {
            panic!("items");
        };
        assert!(unwrapped_items.borrow()[0].strict_eq(Value::Number(1.0)));
        assert!(unwrapped_items.borrow()[1].strict_eq(Value::Number(2.0)));

        let shared = Value::object(
            mc,
            vec![(
                "n".into(),
                Value::Number(1.0).wrap(mc, Origin { start: 0, end: 1 }),
            )],
        );
        let mut cyclic = Value::object(
            mc,
            vec![("shared".into(), shared), ("again".into(), shared)],
        );
        if let Value::Object(properties) = cyclic {
            properties.borrow_mut(mc).set("self".into(), cyclic);
            cyclic = Value::Object(properties);
        }
        let out = cyclic.unwrap_deep(mc);
        let Value::Object(properties) = out else {
            panic!("cyclic object");
        };
        let left = properties.borrow().get("shared").unwrap();
        let right = properties.borrow().get("again").unwrap();
        let again = properties.borrow().get("self").unwrap();
        assert!(left.strict_eq(right));
        assert!(again.strict_eq(out));

        let symbol = Value::object(mc, vec![]);
        if let Value::Object(properties) = symbol {
            properties.borrow_mut(mc).set_symbol(
                "k".into(),
                Value::string(mc, "v").wrap(mc, Origin { start: 0, end: 1 }),
            );
            let unwrapped = Value::Object(properties).unwrap_deep(mc);
            let Value::Object(properties) = unwrapped else {
                panic!("symbol object");
            };
            let Value::String(text) = properties.borrow().get_symbol("k").unwrap().raw() else {
                panic!("symbol value");
            };
            assert_eq!(&*text, "v");
        }

        let date = Value::date(mc, time::OffsetDateTime::UNIX_EPOCH);
        assert!(
            date.wrap(mc, Origin { start: 0, end: 1 })
                .unwrap_deep(mc)
                .strict_eq(date)
        );
        let map = Value::map(mc, vec![]);
        assert!(map.unwrap_deep(mc).strict_eq(map));

        let linear = Value::string(mc, "a").wrap_root(mc);
        if let Value::Located(located) = linear {
            assert_eq!(
                located.chars,
                vec![crate::provenance::CharRun {
                    length: 1,
                    origin: Origin { start: 0, end: 1 },
                    linear: true,
                }]
            );
        }
        let shared_origin = Value::string(mc, "\n").wrap(mc, Origin { start: 10, end: 12 });
        assert_eq!(
            shared_origin.char_origin(0),
            Some(Origin { start: 10, end: 12 })
        );

        let joined = concatenate(
            mc,
            &[
                Value::string(mc, "r").wrap(mc, Origin { start: 10, end: 11 }),
                Value::string(mc, "u").wrap(mc, Origin { start: 11, end: 12 }),
                Value::string(mc, "l").wrap(mc, Origin { start: 12, end: 13 }),
            ],
            Origin { start: 10, end: 13 },
        )
        .unwrap();
        assert_eq!(string_text(joined).unwrap(), "rul");
        assert_eq!(joined.char_origin(1), Some(Origin { start: 11, end: 12 }));
        let crlf = Origin { start: 1, end: 3 };
        let line = concatenate(
            mc,
            &[
                Value::string(mc, "a").wrap(mc, Origin { start: 0, end: 1 }),
                Value::string(mc, "\n").wrap(mc, crlf),
                Value::string(mc, "b").wrap(mc, Origin { start: 3, end: 4 }),
            ],
            Origin { start: 0, end: 4 },
        )
        .unwrap();
        assert_eq!(line.char_origin(1), Some(crlf));
        assert_eq!(
            concatenate(mc, &[], Origin { start: 0, end: 0 })
                .unwrap()
                .char_origin(0),
            None
        );

        let emoji = Value::string(mc, "😀ab").wrap_root(mc);
        assert_eq!(emoji.char_origin(1), Some(Origin { start: 1, end: 2 }));
        assert_eq!(emoji.char_origin(3), None);

        let rooted = Value::string(mc, "héy").wrap_root(mc);
        assert_eq!(rooted.origin(), Some(Origin { start: 0, end: 3 }));
        assert_eq!(rooted.char_origin(2), Some(Origin { start: 2, end: 3 }));
        assert_eq!(
            Value::string(mc, "").wrap_root(mc).origin(),
            Some(Origin { start: 0, end: 0 })
        );
        assert_eq!(
            Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)])
                .wrap_root(mc)
                .origin(),
            Some(Origin { start: 0, end: 1 })
        );
        assert!(inner.same_wrapper(inner.wrap_root(mc)));

        let container = Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)])
            .wrap(mc, Origin { start: 0, end: 2 });
        let carried = container.carry_item(mc, Value::Number(2.0), 1);
        assert_eq!(carried.origin(), Some(Origin { start: 0, end: 2 }));
        assert!(Value::Number(2.0).strict_eq(
            Value::array(mc, vec![Value::Number(1.0)]).carry_item(mc, Value::Number(2.0), 1)
        ));

        let callable =
            Value::Native(crate::globals::NativeGlobal::Id).wrap(mc, Origin { start: 0, end: 1 });
        assert_eq!(
            string_text(callable),
            Err(StringCoercionError::CallableConversion)
        );
        assert_eq!(
            string_text(Value::array(mc, vec![]).wrap(mc, Origin { start: 0, end: 1 })),
            Err(StringCoercionError::CompositeConversion)
        );
        assert!(crate::globals::json_text(callable).is_err());
    });
}

#[test]
// req:then-001 req:and-001 req:or-001 req:character-001 req:variable-001 req:type-001 req:lookahead-001 req:compiled-patterns-002 req:pattern-matching-001
fn engine_port_compiled_patterns_report_then_and_or_and_terminal_outcomes() {
    let mut then = Runtime::for_pattern(
        pattern_of(json!({"kind":"then","patterns":[{"kind":"any"},{"kind":"any"}]})),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    then.run().unwrap();
    then.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert!(result.end < 2);
    });

    let mut both = Runtime::for_pattern(
        pattern_of(json!({
            "kind":"and",
            "patterns":[
                {"kind":"variable","name":"a","pattern":{"kind":"any"}},
                {"kind":"any"}
            ]
        })),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    both.run().unwrap();
    assert_eq!(parsed_result(&mut both), json!("a"));

    let mut choice = Runtime::for_pattern(
        pattern_of(json!({"kind":"or","patterns":[{"kind":"end"},{"kind":"any"}]})),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    choice.run().unwrap();
    assert_eq!(parsed_result(&mut choice), json!("a"));

    let mut unknown = Runtime::for_pattern(
        pattern_of(json!({"kind":"character","characterClass":"not-a-class"})),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    assert_eq!(
        unknown.run().unwrap_err(),
        RuntimeError::Pattern(PatternError::InvalidArgument(
            "unknown character class not-a-class".into()
        ))
    );

    uffda_heap::rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![("a".into(), Value::Number(1.0))]);
        let mut execution = PatternExecution::new(
            mc,
            Pattern::Variable {
                name: "a".into(),
                pattern: Box::new(Pattern::Any),
            },
            vec![Value::string(mc, "x")],
            environment,
        );
        assert_eq!(
            execution.step(mc).unwrap_err(),
            PatternError::DuplicateVariable("a".into())
        );
    });

    let mut typed = Runtime::for_pattern(
        pattern_of(json!({"kind":"type","type":"string"})),
        json!([]),
        InputMode::Iterable,
    )
    .unwrap();
    typed.run().unwrap();
    typed.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.start, 0);
        assert_eq!(result.end, 0);
    });

    let mut lookahead = Runtime::for_pattern(
        pattern_of(json!({
            "kind":"then",
            "patterns":[
                {"kind":"lookahead","pattern":{"kind":"any"}},
                {"kind":"any"}
            ]
        })),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    lookahead.run().unwrap();
    assert_eq!(parsed_result(&mut lookahead), json!(["a", "a"]));
}

#[test]
// req:error-recovery-002 req:error-recovery-001 req:error-recovery-003 req:skip-001 req:skip-002 req:equal-004
fn engine_port_recovered_skip_and_rightmost_follow_the_accepted_match() {
    let recovered = run_text(
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
    recovered.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
        assert!(result.children.iter().any(|child| child.recovered));
        assert!(!execution.is_clean());
    });

    let clean = run_text(
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
    clean.read(|execution| {
        let result = execution.result().unwrap();
        assert!(execution.is_clean());
        assert!(!result.recovered);
        assert!(execution.recoveries().is_empty());
    });

    let mut skipped = Runtime::for_pattern(
        pattern_of(json!({"kind":"skip","pattern":{"kind":"any"}})),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    skipped.run().unwrap();
    skipped.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Skip);
        assert!(result.value.raw().strict_eq(Value::Undefined));
        assert!(execution.is_clean());
    });
    let mut forwarded = Runtime::for_pattern(
        pattern_of(json!({"kind":"then","patterns":[{"kind":"skip","pattern":{"kind":"any"}},{"kind":"any"}]})),
        json!("ab"),
        InputMode::Iterable,
    )
    .unwrap();
    forwarded.run().unwrap();
    forwarded.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert_eq!(
            execution.result().unwrap().children[0].kind,
            MatchKind::Skip
        );
    });
    assert_eq!(parsed_result(&mut forwarded), json!(["b"]));

    let mut furthest = Runtime::for_pattern(
        pattern_of(json!({"kind":"or","patterns":[
            equal(json!("z")),
            {"kind":"then","patterns":[{"kind":"any"},{"kind":"any"},{"kind":"any"},equal(json!("no"))]}
        ]})),
        json!("abcd"),
        InputMode::Iterable,
    )
    .unwrap();
    furthest.run().unwrap();
    furthest.read(|execution| {
        let failure = execution.failure_match().unwrap();
        assert_eq!(failure.pattern_kind, PatternKind::Equal);
        assert_eq!(failure.origin.start, 3);
    });

    let mut same_place = Runtime::for_pattern(
        pattern_of(json!({"kind":"then","patterns":[equal(json!("z"))]})),
        json!("a"),
        InputMode::Iterable,
    )
    .unwrap();
    same_place.run().unwrap();
    same_place.read(|execution| {
        assert_eq!(
            execution.failure_match().unwrap().pattern_kind,
            PatternKind::Then
        );
    });

    let mut inside_skip = Runtime::for_pattern(
        pattern_of(json!({
            "kind":"then",
            "patterns":[{
                "kind":"skip",
                "pattern":{"kind":"then","patterns":[{"kind":"any"},equal(json!("Z"))]}
            }]
        })),
        json!("ab"),
        InputMode::Iterable,
    )
    .unwrap();
    inside_skip.run().unwrap();
    inside_skip.read(|execution| {
        let failure = execution.failure_match().unwrap();
        assert_eq!(failure.origin.start, 1);
        assert_eq!(failure.pattern_kind, PatternKind::Equal);
    });
}

#[test]
// req:error-recovery-001 req:error-recovery-007 req:error-recovery-002 req:error-recovery-003
fn engine_port_statement_recovery_collects_only_the_accepted_phase() {
    let clean = run_text(statement_rules(), "Module", "ab;ab;");
    clean.read(|execution| {
        assert!(execution.is_clean());
        assert!(!execution.result().unwrap().recovered);
        assert!(!execution.result().unwrap().recovery.is_enabled());
        assert!(execution.recoveries().is_empty());
        assert!(execution.diagnostics().is_empty());
    });

    let one = run_text(statement_rules(), "Module", "ab;xx;ab;");
    assert_eq!(recovery_spans(&one), vec![(3, 5)]);
    one.read(|execution| {
        assert!(!execution.is_clean());
        assert_eq!(execution.recoveries()[0].children[0].kind, MatchKind::Fail);
    });

    let ordered = run_text(statement_rules(), "Module", "xx;ab;yyy;");
    assert_eq!(recovery_spans(&ordered), vec![(0, 2), (6, 9)]);

    let failed = run_text(statement_rules(), "Module", "xx;;");
    assert_eq!(recovery_spans(&failed), vec![(0, 2)]);
    failed.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert!(result.recovery.is_enabled());
    });

    let mut missing = run_text_prepared(
        json!([rule("Module", reference("Missing"))]),
        "Module",
        "ab;",
    );
    assert_eq!(
        missing.run().unwrap_err(),
        RuntimeError::UnknownRule("Missing".into())
    );
    assert_eq!(missing.diagnostics()[0].kind, DiagnosticKind::Error);
    missing.read(|execution| assert!(execution.recoveries().is_empty()));

    let skipped = run_text(statement_rules(), "Module", "ab;ab");
    skipped.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert!(!result.recovery.is_enabled());
        assert!(execution.recoveries().is_empty());
    });

    let with_recovery = run_text(
        json!([
            rule(
                "Probe",
                json!({"kind":"then","patterns":[
                    {"kind":"not","pattern":reference("Stmt")},
                    reference("Stmt")
                ]})
            ),
            rule(
                "Stmt",
                json!({"kind":"or","patterns":[
                    {
                        "kind":"recover",
                        "pattern":{"kind":"then","patterns":[equal(json!("a")), equal(json!("b"))]},
                        "skip": until_semicolon()
                    },
                    {"kind":"then","patterns":[{"kind":"fail"}, reference("Stmt")]}
                ]})
            )
        ]),
        "Probe",
        "xx;",
    );
    assert_eq!(recovery_spans(&with_recovery), vec![(0, 2)]);
    with_recovery.read(|execution| assert!(execution.result().unwrap().recovered));

    let rejected = run_text(
        json!([rule(
            "Main",
            json!({"kind":"or","patterns":[
                {
                    "kind":"recover",
                    "pattern":{"kind":"then","patterns":[equal(json!("a")), equal(json!("b"))]},
                    "skip": until_semicolon()
                },
                equal(json!("x"))
            ]})
        )]),
        "Main",
        "x",
    );
    rejected.read(|execution| {
        assert!(execution.is_clean());
        assert!(execution.recoveries().is_empty());
        let result = execution.result().unwrap();
        let mut saw_failure = false;
        let mut pending = vec![result];
        while let Some(node) = pending.pop() {
            saw_failure |= node.kind == MatchKind::Fail;
            pending.extend(node.children.iter().copied());
        }
        assert!(
            saw_failure,
            "the rejected recover alternative stays in the match tree"
        );
    });

    let preceded = run_text(statement_rules(), "Module", "ab;xx;");
    preceded.read(|execution| {
        let preceding = recovery_preceding(execution.result().unwrap());
        assert_eq!(preceding, vec![vec![(0, 3)]]);
    });
    let first = run_text(statement_rules(), "Module", "xx;");
    first.read(|execution| {
        assert_eq!(
            recovery_preceding(execution.result().unwrap()),
            vec![vec![]]
        );
    });
}

fn run_text_prepared(rules: Json, entry: &str, input: &str) -> Runtime {
    let (compiled, url) = graph(rules, entry);
    Runtime::with_mode(compiled, &url, None, json!(input), InputMode::Iterable).unwrap()
}

fn recovery_preceding<'gc>(root: Gc<'gc, PatternMatch<'gc>>) -> Vec<Vec<(usize, usize)>> {
    let mut found = Vec::new();
    let mut stack = vec![(root, Vec::<Gc<'gc, PatternMatch<'gc>>>::new())];
    while let Some((node, preceding)) = stack.pop() {
        if node.kind != MatchKind::Fail
            && node.recovered
            && node.is_recovery_node()
            && node
                .children
                .first()
                .is_some_and(|child| child.kind == MatchKind::Fail)
        {
            found.push(
                preceding
                    .iter()
                    .map(|matched| (matched.start, matched.end))
                    .collect(),
            );
        }
        let children: Vec<_> = node.children.iter().copied().collect();
        for (index, child) in children.iter().enumerate().rev() {
            if node.kind == MatchKind::Fail || child.recovered {
                let next = if index == 0 {
                    preceding.clone()
                } else {
                    children[..index].to_vec()
                };
                stack.push((*child, next));
            }
        }
    }
    found.reverse();
    found
}

#[test]
// req:error-recovery-008 req:error-recovery-007 req:compiled-patterns-003
fn engine_port_recovery_diagnostics_are_source_spans_in_document_order() {
    let clean = run_text(statement_rules(), "Module", "ab;ab;");
    assert!(clean.diagnostics().is_empty());

    let several = run_text(statement_rules(), "Module", "ab;xx;ab;axb;");
    let diagnostics = several.diagnostics();
    assert_eq!(
        diagnostics
            .iter()
            .map(|diagnostic| (diagnostic.span, diagnostic.message.as_str()))
            .collect::<Vec<_>>(),
        vec![
            (
                Origin { start: 3, end: 5 },
                "Expected \"a\"\nUnexpected \"x\"\nIn Stmt"
            ),
            (
                Origin { start: 9, end: 12 },
                "Expected \"b\"\nUnexpected \"x\"\nIn Stmt"
            ),
        ]
    );
    assert!(diagnostics[0].rules.iter().any(|rule| rule.name == "Stmt"));

    let failed = run_text(statement_rules(), "Module", "xx;;");
    assert_eq!(
        failed
            .diagnostics()
            .iter()
            .filter(|diagnostic| diagnostic.kind == DiagnosticKind::Recovery)
            .map(|diagnostic| diagnostic.span)
            .collect::<Vec<_>>(),
        vec![Origin { start: 0, end: 2 }]
    );

    let (compiled, url) = module_graph(json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [
            rule(
                "Main",
                json!({"kind":"then","patterns":[
                    {"kind":"quantifier","pattern":{"kind":"then","patterns":[
                        reference("Stmt"),
                        equal(json!(";"))
                    ]}},
                    {"kind":"end"}
                ]})
            ),
            {
                "name":"Stmt",
                "parameters":[],
                "pattern":{
                    "kind":"recover",
                    "pattern":{"kind":"then","patterns":[equal(json!("a")), equal(json!("b"))]},
                    "skip": until_semicolon()
                },
                "attributes":[{"name":"Why","args":[{"kind":"value","value":"A statement is ab."}]}]
            }
        ],
        "funcs": [],
        "decorators": [{
            "name":"Why",
            "pattern":{"kind":"any"},
            "expression":{"kind":"reference","name":"_"}
        }]
    }));
    let mut explained =
        Runtime::with_mode(compiled, &url, None, json!("ab;xx;"), InputMode::Iterable).unwrap();
    explained.run().unwrap();
    let diagnostics = explained.diagnostics_with(|declaration| {
        let Value::Object(metadata) = declaration.metadata.raw() else {
            return None;
        };
        let Value::String(text) = metadata.borrow().get("Why")?.raw() else {
            return None;
        };
        Some(text.to_utf8().expect("scalar explanation"))
    });
    assert_eq!(
        diagnostics
            .iter()
            .map(|diagnostic| diagnostic.message.as_str())
            .collect::<Vec<_>>(),
        vec!["A statement is ab.\nUnexpected \"x\"\nIn Stmt"]
    );
    assert_eq!(
        diagnostics[0].explanation.as_deref(),
        Some("A statement is ab.")
    );

    let absorbed = run_text(
        json!([
            rule(
                "Main",
                json!({"kind":"then","patterns":[
                    {"kind":"quantifier","pattern":{"kind":"then","patterns":[
                        reference("Ops"),
                        reference("Stmt"),
                        equal(json!(";"))
                    ]}},
                    {"kind":"end"}
                ]})
            ),
            rule(
                "Ops",
                json!({"kind":"quantifier","pattern":{"kind":"then","patterns":[
                    equal(json!("|")),
                    equal(json!("c"))
                ]}})
            ),
            rule(
                "Stmt",
                json!({
                    "kind":"recover",
                    "pattern":{"kind":"then","patterns":[equal(json!("a")), equal(json!("b"))]},
                    "skip": until_semicolon()
                })
            )
        ]),
        "Main",
        "|;",
    );
    let diagnostics = absorbed.diagnostics();
    assert_eq!(diagnostics.len(), 1, "{diagnostics:#?}");
    assert_eq!(diagnostics[0].span, Origin { start: 0, end: 1 });
    assert_eq!(
        diagnostics[0].message,
        "Expected \"c\"\nUnexpected \";\"\nIn Ops"
    );
}

#[test]
// req:incremental-parsing-001 req:incremental-parsing-002 req:selective-memoization-001 req:selective-memoization-003
fn engine_port_incremental_edit_reuses_letters_before_the_edit() {
    let rules = json!([
        rule(
            "letters",
            json!({"kind":"quantifier","pattern":reference("group")})
        ),
        rule(
            "group",
            json!({"kind":"or","patterns":[reference("letter"), reference("group")]})
        ),
        rule("letter", json!({"kind":"character","characterClass":"L"}))
    ]);
    let (compiled, url) = graph(rules, "letters");
    let mut edited = Runtime::with_mode(
        compiled.clone(),
        &url,
        None,
        json!("abcdef"),
        InputMode::Iterable,
    )
    .unwrap();
    edited.run().unwrap();
    assert_eq!(
        parsed_result(&mut edited),
        json!(["a", "b", "c", "d", "e", "f"])
    );
    edited
        .reparse_edit(json!("abcXdef"), InputMode::Iterable, 3, 0, 1)
        .unwrap();
    edited.run().unwrap();
    assert!(
        edited.read(|execution| execution.memo_hits()) >= 3,
        "group invocations before the edit are reused"
    );
    assert_eq!(
        parsed_result(&mut edited),
        json!(["a", "b", "c", "X", "d", "e", "f"])
    );
    let mut fresh =
        Runtime::with_mode(compiled, &url, None, json!("abcXdef"), InputMode::Iterable).unwrap();
    fresh.run().unwrap();
    assert_eq!(
        edited.serialize_result().unwrap(),
        fresh.serialize_result().unwrap()
    );
    assert_eq!(edited.diagnostics(), fresh.diagnostics());
}

#[test]
// req:incremental-parsing-001 req:incremental-parsing-003 req:indirect-left-recursion-002
fn engine_port_incremental_seeded_edit_matches_a_fresh_parse() {
    let rules = json!([
        rule("E", reference("T")),
        rule(
            "T",
            json!({"kind":"or","patterns":[
                {"kind":"then","patterns":[reference("E"), equal(json!("+")), equal(json!("n"))]},
                equal(json!("n"))
            ]})
        )
    ]);
    let (compiled, url) = graph(rules, "E");
    let mut edited = Runtime::with_mode(
        compiled.clone(),
        &url,
        None,
        json!("n+n+n"),
        InputMode::Iterable,
    )
    .unwrap();
    edited.run().unwrap();
    edited
        .reparse_edit(json!("n+n+n+n"), InputMode::Iterable, 4, 1, 3)
        .unwrap();
    edited.run().unwrap();
    let mut fresh =
        Runtime::with_mode(compiled, &url, None, json!("n+n+n+n"), InputMode::Iterable).unwrap();
    fresh.run().unwrap();
    let expected = json!([[["n", "+", "n"], "+", "n"], "+", "n"]);
    assert_eq!(parsed_result(&mut fresh), expected);
    assert_eq!(parsed_result(&mut edited), expected);
}

#[test]
// req:error-recovery-005 req:memo-eviction-001
fn engine_port_memo_keys_isolate_the_recovery_setting() {
    let position = InputPosition {
        domain: 1,
        path: vec![],
        cursor: 0,
    };
    let clean = MemoKey {
        target: 1,
        position: position.clone(),
        recovery: false,
    };
    let recovering = MemoKey {
        target: 1,
        position,
        recovery: true,
    };
    assert_ne!(clean, recovering);
    let mut keys = std::collections::HashMap::new();
    keys.insert(clean, 0);
    keys.insert(recovering.clone(), 1);
    assert_eq!(keys.len(), 2);
    assert_eq!(keys.get(&recovering), Some(&1));
}

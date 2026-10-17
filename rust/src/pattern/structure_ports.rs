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

use crate::evaluate::StepStatus;
use crate::module::CompiledModuleGraph;
use crate::provenance::{CharRun, Located, Origin};
use crate::resolver::{Resolver, decode_declaration};
use crate::runtime::{InputMode, Runtime};
use std::rc::Rc;
use uffda_heap::Gc;
use url::Url;

fn project(pattern: Pattern, expression: serde_json::Value) -> Pattern {
    Pattern::Projection {
        pattern: Box::new(pattern),
        expression: Box::new(serde_json::from_value(expression).unwrap()),
    }
}

fn star(pattern: Pattern) -> Pattern {
    Pattern::Quantifier {
        pattern: Box::new(pattern),
        min: None,
        max: None,
    }
}

fn exactly(count: i64, pattern: Pattern) -> Pattern {
    let bound = ValueSource::Literal {
        value: LiteralValue::Present(json!(count).into()),
    };
    Pattern::Quantifier {
        pattern: Box::new(pattern),
        min: Some(bound.clone()),
        max: Some(bound),
    }
}

fn undefined_literal() -> Pattern {
    Pattern::Equal {
        value: ValueSource::Literal {
            value: LiteralValue::Missing,
        },
    }
}

fn map_with(body: serde_json::Value) -> serde_json::Value {
    json!({
        "kind": "array",
        "expressions": [{
            "kind": "arraySpread",
            "expression": {
                "kind": "invocation",
                "expression": {"kind": "reference", "name": "map"},
                "args": [
                    {"kind": "reference", "name": "_"},
                    {
                        "kind": "lambda",
                        "pattern": {"kind": "variable", "name": "n", "pattern": {"kind": "any"}},
                        "expression": body
                    }
                ]
            }
        }]
    })
}

fn add_expr(left: serde_json::Value, right: serde_json::Value) -> serde_json::Value {
    json!({
        "kind": "invocation",
        "expression": {"kind": "reference", "name": "add"},
        "args": [left, right]
    })
}

fn nested_text(value: Value<'_>) -> String {
    match value.raw() {
        Value::Undefined => "undefined".into(),
        Value::Number(number) => number.to_string(),
        Value::Boolean(value) => value.to_string(),
        Value::String(text) => text.to_utf8().unwrap(),
        Value::Array(items) => format!(
            "[{}]",
            items
                .borrow()
                .iter()
                .map(|item| nested_text(*item))
                .collect::<Vec<_>>()
                .join(",")
        ),
        other => panic!("unexpected match value {:?}", other.runtime_type()),
    }
}

fn assert_nested(
    pattern: Pattern,
    input: serde_json::Value,
    kind: MatchKind,
    end: usize,
    value: &str,
) {
    let mut runtime = Runtime::for_pattern(pattern, input, InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, kind);
        assert_eq!(result.end, end);
        if kind != MatchKind::Fail {
            assert_eq!(nested_text(result.value), value);
        }
    });
}

fn failure_origin<'gc>(root: Gc<'gc, PatternMatch<'gc>>) -> Origin {
    let mut best = root;
    let mut pending: Vec<_> = root.children.iter().copied().collect();
    while let Some(node) = pending.pop() {
        if node.kind == MatchKind::Fail && node.start > best.start {
            best = node;
        }
        pending.extend(node.children.iter().copied());
    }
    best.origin
}

fn located_text<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    text: &str,
    start: usize,
    end: usize,
) -> Value<'gc> {
    let raw = Value::string(mc, text);
    let length = match raw.raw() {
        Value::String(value) => value.code_points().count(),
        _ => unreachable!("string value"),
    };
    Value::Located(Gc::new(
        mc,
        Located {
            raw,
            origin: Origin { start, end },
            chars: vec![CharRun {
                length,
                origin: Origin { start, end },
                linear: true,
            }],
        },
    ))
}

fn rule_json(name: &str, parameters: &[&str], pattern: serde_json::Value) -> serde_json::Value {
    json!({
        "name": name,
        "parameters": parameters.iter().map(|name| json!({"name": name})).collect::<Vec<_>>(),
        "pattern": pattern,
    })
}

fn reference_json(name: &str, args: serde_json::Value) -> serde_json::Value {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":args})
}

fn equal_json(value: serde_json::Value) -> serde_json::Value {
    json!({"kind":"equal","value":{"kind":"value.literal","value":value}})
}

fn module_json(
    imports: serde_json::Value,
    entry: &str,
    rules: Vec<serde_json::Value>,
) -> serde_json::Value {
    json!({
        "imports": imports,
        "exports": [{"kind":"rule","name":entry,"default":true}],
        "rules": rules,
    })
}

fn run_modules(
    modules: &[(&str, serde_json::Value)],
    entry: &str,
    input: serde_json::Value,
) -> Result<(MatchKind, usize, String), String> {
    let mut resolver = Resolver::from_cwd().map_err(|error| error.message)?;
    for (url, module) in modules {
        let url = Url::parse(url).unwrap();
        resolver.insert_declaration(
            url.clone(),
            decode_declaration(&url, &module.to_string()).map_err(|error| error.message)?,
        );
    }
    let entry = Url::parse(entry).unwrap();
    let graph = resolver.load_graph(&entry).map_err(|error| error.message)?;
    let graph = CompiledModuleGraph::compile(graph).map_err(|error| error.to_string())?;
    let mut runtime = Runtime::with_mode(Rc::new(graph), &entry, None, input, InputMode::Iterable)
        .map_err(|error| error.to_string())?;
    for _ in 0..20_000 {
        match runtime.step_status().map_err(|error| error.to_string())? {
            StepStatus::Complete => {
                return runtime.read(|execution| {
                    let result = execution.result().unwrap();
                    Ok((result.kind, result.end, nested_text(result.value)))
                });
            }
            StepStatus::Yielded => {}
            StepStatus::Suspended => return Err("suspended".into()),
        }
    }
    Err("did not finish".into())
}

#[test]
// req:pipeline-001
fn pipeline_port_any_step_returns_the_item() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![Pattern::Any],
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "a",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_feeds_projected_value_to_the_next_step() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![
                project(literal(json!(0)), json!({"kind":"value","value":1})),
                project(literal(json!(1)), json!({"kind":"value","value":2})),
            ],
        },
        json!([0]),
        MatchKind::Ok,
        1,
        "2",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_maps_then_into_maps_again() {
    let plus_one = map_with(add_expr(
        json!({"kind":"reference","name":"n"}),
        json!({"kind":"number","value":1}),
    ));
    let times_two = map_with(add_expr(
        json!({"kind":"reference","name":"n"}),
        json!({"kind":"reference","name":"n"}),
    ));
    assert_nested(
        Pattern::Pipeline {
            steps: vec![
                project(star(Pattern::Any), plus_one),
                Pattern::Into {
                    pattern: Box::new(project(star(Pattern::Any), times_two)),
                },
            ],
        },
        json!([1, 2, 3]),
        MatchKind::Ok,
        3,
        "[4,6,8]",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_any_then_mapped_quantifier() {
    assert_nested(
        Pattern::Pipeline {
            steps: vec![
                Pattern::Any,
                project(
                    star(Pattern::Any),
                    map_with(add_expr(
                        json!({"kind":"reference","name":"n"}),
                        json!({"kind":"reference","name":"n"}),
                    )),
                ),
            ],
        },
        json!([11]),
        MatchKind::Ok,
        1,
        "[22]",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_quantifier_reduces_to_a_sum() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![project(
                star(Pattern::Any),
                json!({
                    "kind": "invocation",
                    "expression": {"kind": "reference", "name": "reduce"},
                    "args": [
                        {"kind": "reference", "name": "_"},
                        {"kind": "number", "value": 0},
                        {
                            "kind": "lambda",
                            "pattern": {
                                "kind": "then",
                                "patterns": [
                                    {"kind": "variable", "name": "i", "pattern": {"kind": "any"}},
                                    {"kind": "variable", "name": "n", "pattern": {"kind": "any"}}
                                ]
                            },
                            "expression": add_expr(
                                json!({"kind":"reference","name":"i"}),
                                json!({"kind":"reference","name":"n"}),
                            )
                        }
                    ]
                }),
            )],
        },
        json!([1, 2, 3]),
        MatchKind::Ok,
        3,
        "6",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_nested_pipeline_into_joins_characters() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![
                Pattern::Pipeline {
                    steps: vec![star(Pattern::Any)],
                },
                Pattern::Into {
                    pattern: Box::new(project(
                        exactly(3, Pattern::Any),
                        json!({
                            "kind": "invocation",
                            "expression": {"kind": "reference", "name": "join"},
                            "args": [
                                {"kind": "reference", "name": "_"},
                                {"kind": "value", "value": "-"}
                            ]
                        }),
                    )),
                },
            ],
        },
        json!("abc"),
        MatchKind::Ok,
        3,
        "a-b-c",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_nested_pipeline_inside_then() {
    assert_nested(
        Pattern::Then {
            patterns: vec![
                literal(json!("a")),
                Pattern::Pipeline {
                    steps: vec![Pattern::Pipeline {
                        steps: vec![star(literal(json!("b")))],
                    }],
                },
                literal(json!("c")),
            ],
        },
        json!("abc"),
        MatchKind::Ok,
        3,
        "[a,[b],c]",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_preserves_outer_stream_after_type_step() {
    assert_nested(
        Pattern::Then {
            patterns: vec![
                Pattern::Pipeline {
                    steps: vec![
                        literal(json!("a")),
                        Pattern::Type {
                            expected: RuntimeType::String,
                        },
                    ],
                },
                literal(json!("b")),
            ],
        },
        json!("ab"),
        MatchKind::Ok,
        2,
        "[a,b]",
    );
}

#[test]
// req:pipeline-001
fn pipeline_port_carried_string_keeps_character_origins() {
    uffda_heap::rootless_mutate(|mc| {
        let pattern = Pattern::Pipeline {
            steps: vec![
                literal(json!("abc")),
                Pattern::Into {
                    pattern: Box::new(Pattern::Then {
                        patterns: vec![literal(json!("a")), literal(json!("x"))],
                    }),
                },
            ],
        };
        let mut execution = PatternExecution::new(
            mc,
            pattern,
            vec![located_text(mc, "abc", 40, 43)],
            Environment::new(mc, None, vec![]),
        );
        while !execution.step(mc).unwrap() {}
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(failure_origin(result).start, 41);
    });
}

#[test]
// req:pipeline-001
fn pipeline_port_carried_items_keep_origins() {
    uffda_heap::rootless_mutate(|mc| {
        let pattern = Pattern::Pipeline {
            steps: vec![
                star(Pattern::Any),
                Pattern::Into {
                    pattern: Box::new(literal(json!("x"))),
                },
            ],
        };
        let input = [(10, "a"), (11, "!"), (12, "c")]
            .into_iter()
            .map(|(start, text)| {
                Value::string(mc, text).wrap(
                    mc,
                    Origin {
                        start,
                        end: start + 1,
                    },
                )
            })
            .collect();
        let mut execution =
            PatternExecution::new(mc, pattern, input, Environment::new(mc, None, vec![]));
        while !execution.step(mc).unwrap() {}
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(failure_origin(result).start, 10);
    });
}

#[test]
// req:pipeline-001
fn pipeline_port_later_steps_see_outer_variables() {
    uffda_heap::rootless_mutate(|mc| {
        let pattern = Pattern::Pipeline {
            steps: vec![
                Pattern::Type {
                    expected: RuntimeType::Number,
                },
                Pattern::And {
                    patterns: vec![
                        Pattern::Type {
                            expected: RuntimeType::Number,
                        },
                        Pattern::Between {
                            left: Some(ValueSource::Variable { name: "n".into() }),
                            right: None,
                        },
                    ],
                },
            ],
        };
        let environment = Environment::new(mc, None, vec![(Rc::from("n"), Value::Number(3.0))]);
        let mut execution =
            PatternExecution::new(mc, pattern, vec![Value::Number(5.0)], environment);
        while !execution.step(mc).unwrap() {}
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert_eq!(result.end, 1);
        assert!(result.value.strict_eq(Value::Number(5.0)));
    });
}

#[test]
// req:pipeline-001
fn pipeline_port_failure_reports_steps_that_ran() {
    let mut runtime = Runtime::for_pattern(
        Pattern::Pipeline {
            steps: vec![literal(json!("a")), Pattern::Any],
        },
        json!("b"),
        InputMode::Iterable,
    )
    .unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.pattern_kind, PatternKind::Pipeline);
        assert_eq!(result.end, 0);
        assert_eq!(result.children.len(), 1);
        assert_eq!(result.children[0].pattern_kind, PatternKind::Equal);
        assert_eq!(result.children[0].kind, MatchKind::Fail);
    });
}

#[test]
// req:pipeline-001
fn pipeline_port_open_stage_follows_the_previous_stage() {
    let pattern = || Pattern::Pipeline {
        steps: vec![
            star(Pattern::Type {
                expected: RuntimeType::String,
            }),
            star(Pattern::Any),
        ],
    };
    let stage_kinds = |open: bool| {
        uffda_heap::rootless_mutate(|mc| {
            let input = vec![Value::string(mc, "a"), Value::string(mc, "b")];
            let environment = Environment::new(mc, None, vec![]);
            let mut execution = if open {
                PatternExecution::new_open(mc, pattern(), input, environment)
            } else {
                PatternExecution::new(mc, pattern(), input, environment)
            };
            while !execution.step(mc).unwrap() {}
            let result = execution.result().unwrap();
            assert_eq!(result.kind, MatchKind::Ok);
            let last = result.children[result.children.len() - 1];
            assert_eq!(last.kind, MatchKind::Ok);
            last.children
                .iter()
                .map(|child| child.kind)
                .collect::<Vec<_>>()
        })
    };
    assert_eq!(stage_kinds(true), vec![MatchKind::Ok, MatchKind::Fail]);
    assert_eq!(stage_kinds(false), vec![MatchKind::Ok]);
}

#[test]
// req:pipeline-001 req:skip-001 req:skip-002
fn pipeline_port_skipped_final_step_is_skipped() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![
                Pattern::Any,
                Pattern::Skip {
                    pattern: Box::new(literal(json!("a"))),
                },
            ],
        },
        json!("a"),
        MatchKind::Skip,
        1,
        "undefined",
    );
}

#[test]
// req:pipeline-001 req:skip-001
fn pipeline_port_skipped_earlier_step_passes_undefined() {
    assert_item(
        Pattern::Pipeline {
            steps: vec![
                Pattern::Skip {
                    pattern: Box::new(literal(json!("a"))),
                },
                undefined_literal(),
            ],
        },
        json!("a"),
        MatchKind::Ok,
        1,
        "undefined",
    );
}

#[test]
// req:pipeline-001 req:resolve-001
fn pipeline_port_step_resolves_enclosing_rule_parameter() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json(
                "Main",
                &[],
                reference_json("Outer", json!([equal_json(json!("a"))])),
            ),
            rule_json(
                "Outer",
                &["P"],
                json!({
                    "kind": "pipeline",
                    "steps": [
                        {"kind": "any"},
                        reference_json("P", json!([]))
                    ]
                }),
            ),
        ],
    );
    let (kind, end, value) = run_modules(
        &[("file:///pipeline-port.json", module)],
        "file:///pipeline-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(end, 1);
    assert_eq!(value, "a");
}

#[test]
// req:pipeline-001 req:resolve-001
fn pipeline_port_stages_at_one_position_keep_memos_apart() {
    let array_of = |number: i64| {
        json!({
            "kind": "array",
            "expressions": [{
                "kind": "arrayElement",
                "expression": {"kind": "number", "value": number}
            }]
        })
    };
    let stage = |name: &str, number: i64| {
        json!({
            "kind": "variable",
            "name": name,
            "pattern": {
                "kind": "pipeline",
                "steps": [
                    {
                        "kind": "projection",
                        "pattern": {"kind": "ok"},
                        "expression": array_of(number)
                    },
                    reference_json("Rec", json!([]))
                ]
            }
        })
    };
    let module = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Test","default":true}],
        "rules": [
            rule_json("Rec", &[], json!({
                "kind": "or",
                "patterns": [
                    {
                        "kind": "projection",
                        "pattern": {
                            "kind": "and",
                            "patterns": [
                                {"kind": "type", "type": "array"},
                                {
                                    "kind": "into",
                                    "pattern": {
                                        "kind": "variable",
                                        "name": "r",
                                        "pattern": {
                                            "kind": "quantifier",
                                            "pattern": reference_json("Rec", json!([]))
                                        }
                                    }
                                }
                            ]
                        },
                        "expression": {"kind": "reference", "name": "r"}
                    },
                    {"kind": "any"}
                ]
            })),
            json!({
                "name": "Test",
                "parameters": [],
                "pattern": {"kind": "then", "patterns": [stage("a", 1), stage("b", 2)]},
                "expression": {
                    "kind": "array",
                    "expressions": [
                        {"kind": "arrayElement", "expression": {"kind": "reference", "name": "a"}},
                        {"kind": "arrayElement", "expression": {"kind": "reference", "name": "b"}}
                    ]
                }
            })
        ]
    });
    let (kind, _, value) = run_modules(
        &[("file:///pipeline-layer.json", module)],
        "file:///pipeline-layer.json",
        json!([]),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "[[1],[2]]");
}

#[test]
// req:resolve-001
fn reference_port_named_rule_matches_its_body() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("A", &[], equal_json(json!("a"))),
            rule_json("Main", &[], reference_json("A", json!([]))),
        ],
    );
    let (kind, end, value) = run_modules(
        &[("file:///reference-port.json", module)],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!((kind, end, value.as_str()), (MatchKind::Ok, 1, "a"));
}

#[test]
// req:resolve-001
fn reference_port_parameter_receives_an_argument_rule() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("A", &["T"], reference_json("T", json!([]))),
            rule_json("B", &[], equal_json(json!("a"))),
            rule_json(
                "Main",
                &[],
                reference_json("A", json!([reference_json("B", json!([]))])),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///reference-port.json", module)],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn reference_port_rejects_a_self_reference_argument() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("A", &["T"], reference_json("T", json!([]))),
            rule_json(
                "Main",
                &[],
                reference_json("A", json!([reference_json("A", json!([]))])),
            ),
        ],
    );
    let error = run_modules(
        &[("file:///reference-port.json", module)],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap_err();
    assert_eq!(error, "invalid self reference: A");
}

#[test]
// req:resolve-001
fn reference_port_argument_rule_runs_in_the_callers_module() {
    let main = module_json(
        json!([{
            "kind": "module",
            "moduleUrl": "file:///a.ts",
            "names": ["A"]
        }]),
        "Main",
        vec![
            rule_json("B", &[], equal_json(json!("a"))),
            rule_json(
                "Main",
                &[],
                reference_json("A", json!([reference_json("B", json!([]))])),
            ),
        ],
    );
    let other = module_json(
        json!([]),
        "A",
        vec![rule_json("A", &["T"], reference_json("T", json!([])))],
    );
    let (kind, _, value) = run_modules(
        &[
            ("file:///reference-port.json", main),
            ("file:///a.ts", other),
        ],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn reference_port_passed_rule_resolves_names_in_its_own_module() {
    let main = module_json(
        json!([{
            "kind": "module",
            "moduleUrl": "file:///a.ts",
            "names": ["A"]
        }]),
        "Main",
        vec![
            rule_json("B", &[], reference_json("C", json!([]))),
            rule_json("C", &[], equal_json(json!("a"))),
            rule_json(
                "Main",
                &[],
                reference_json("A", json!([reference_json("B", json!([]))])),
            ),
        ],
    );
    let other = module_json(
        json!([]),
        "A",
        vec![rule_json("A", &["T"], reference_json("T", json!([])))],
    );
    let (kind, _, value) = run_modules(
        &[
            ("file:///reference-port.json", main),
            ("file:///a.ts", other),
        ],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn reference_port_parameters_can_be_forwarded_as_arguments() {
    let main = module_json(
        json!([{
            "kind": "module",
            "moduleUrl": "file:///a.ts",
            "names": ["A"]
        }]),
        "Main",
        vec![
            rule_json("B", &["T"], reference_json("T", json!([]))),
            rule_json("C", &[], equal_json(json!("a"))),
            rule_json(
                "Main",
                &[],
                reference_json(
                    "A",
                    json!([
                        reference_json("B", json!([])),
                        reference_json("C", json!([]))
                    ]),
                ),
            ),
        ],
    );
    let other = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"A"}],
        "rules": [rule_json(
            "A",
            &["T0", "T1"],
            reference_json("T0", json!([reference_json("T1", json!([]))]))
        )]
    });
    let (kind, _, value) = run_modules(
        &[
            ("file:///reference-port.json", main),
            ("file:///a.ts", other),
        ],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn reference_port_missing_export_is_rejected_at_load() {
    let main = module_json(
        json!([{
            "kind": "module",
            "moduleUrl": "file:///a.ts",
            "names": ["A"]
        }]),
        "Main",
        vec![rule_json("Main", &[], reference_json("A", json!([])))],
    );
    let other = json!({
        "imports": [],
        "exports": [],
        "rules": [rule_json("A", &[], equal_json(json!("a")))]
    });
    let error = run_modules(
        &[
            ("file:///reference-port.json", main),
            ("file:///a.ts", other),
        ],
        "file:///reference-port.json",
        json!("a"),
    )
    .unwrap_err();
    assert_eq!(error, "Unknown export A from module file:///a.ts");
}

#[test]
// req:resolve-001
fn resolve_pattern_port_reference_runs_the_named_rule() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("A", &[], equal_json(json!("a"))),
            rule_json("Main", &[], reference_json("A", json!([]))),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn resolve_pattern_port_run_without_a_name_fails() {
    let module = module_json(
        json!([]),
        "Main",
        vec![rule_json(
            "Main",
            &[],
            json!({"kind":"resolve","targetKind":"run"}),
        )],
    );
    let (kind, end, _) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Fail);
    assert_eq!(end, 0);
}

#[test]
// req:resolve-001
fn resolve_pattern_port_argument_pattern_is_invoked() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("Wrap", &["P"], reference_json("P", json!([]))),
            rule_json(
                "Main",
                &[],
                reference_json("Wrap", json!([equal_json(json!("a"))])),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn resolve_pattern_port_nested_argument_patterns_are_invoked() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("Wrap", &["P"], reference_json("P", json!([]))),
            rule_json("Inner", &["Q"], reference_json("Q", json!([]))),
            rule_json(
                "Main",
                &[],
                reference_json(
                    "Wrap",
                    json!([reference_json("Inner", json!([equal_json(json!("a"))]))]),
                ),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn resolve_pattern_port_parameter_is_forwarded_to_another_rule() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("Wrap", &["Q"], reference_json("Q", json!([]))),
            rule_json(
                "Relay",
                &["P"],
                reference_json("Wrap", json!([reference_json("P", json!([]))])),
            ),
            rule_json(
                "Main",
                &[],
                reference_json("Relay", json!([equal_json(json!("a"))])),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001
fn resolve_pattern_port_forwarded_parameters_nest_through_rules() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("Wrap", &["Q"], reference_json("Q", json!([]))),
            rule_json(
                "Inner",
                &["R"],
                reference_json("Wrap", json!([reference_json("R", json!([]))])),
            ),
            rule_json(
                "Relay",
                &["P"],
                reference_json(
                    "Wrap",
                    json!([reference_json(
                        "Inner",
                        json!([reference_json("P", json!([]))])
                    )]),
                ),
            ),
            rule_json(
                "Main",
                &[],
                reference_json("Relay", json!([equal_json(json!("a"))])),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-pattern-port.json", module)],
        "file:///resolve-pattern-port.json",
        json!("a"),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "a");
}

#[test]
// req:resolve-001 req:runtime-core-010
fn resolve_scope_port_inline_argument_sees_the_caller_variable() {
    let module = module_json(
        json!([]),
        "Main",
        vec![
            rule_json("Show", &["C"], reference_json("C", json!([]))),
            rule_json(
                "Main",
                &[],
                json!({
                    "kind": "and",
                    "patterns": [
                        {
                            "kind": "variable",
                            "name": "x",
                            "pattern": {
                                "kind": "projection",
                                "pattern": {"kind": "ok"},
                                "expression": {"kind": "value", "value": "v"}
                            }
                        },
                        reference_json("Show", json!([{
                            "kind": "projection",
                            "pattern": {"kind": "ok"},
                            "expression": {"kind": "reference", "name": "x"}
                        }]))
                    ]
                }),
            ),
        ],
    );
    let (kind, _, value) = run_modules(
        &[("file:///resolve-scope-port.json", module)],
        "file:///resolve-scope-port.json",
        json!([]),
    )
    .unwrap();
    assert_eq!(kind, MatchKind::Ok);
    assert_eq!(value, "v");
}

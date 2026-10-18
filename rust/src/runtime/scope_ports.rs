#![allow(unused_imports)]
use super::*;
use crate::coercion::{StringCoercionError, string_text};
use crate::environment::Environment;
use crate::evaluate::{CompiledExpression, EvaluationError, ExpressionExecution};
use crate::expression::{Expression, ObjectInitializer};
use crate::globals::{self, NativeGlobal};
use crate::pattern::{
    LiteralValue, MatchKind, Pattern, PatternExecution, ResolveTargetKind, ValueSource,
};
use crate::provenance::{Origin, concatenate};
use crate::value::Value;
use input::RecoveryContext;
use serde_json::json;
use uffda_heap::rootless_mutate;

fn literal(value: serde_json::Value) -> Pattern {
    Pattern::Equal {
        value: ValueSource::Literal {
            value: LiteralValue::Present(value.into()),
        },
    }
}

fn assert_span(
    pattern: Pattern,
    input: serde_json::Value,
    mode: InputMode,
    kind: MatchKind,
    start: usize,
    end: usize,
) {
    let mut runtime = Runtime::for_pattern(pattern, input, mode).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, kind);
        assert_eq!(result.start, start);
        assert_eq!(result.end, end);
    });
}

fn argument_pattern() -> Pattern {
    Pattern::Quantifier {
        pattern: Box::new(Pattern::Any),
        min: None,
        max: None,
    }
}

fn lambda<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    environment: Environment<'gc>,
    expression: Expression,
) -> Value<'gc> {
    CompiledExpression::new(expression).bind(
        mc,
        environment,
        Origin { start: 0, end: 0 },
        argument_pattern(),
    )
}

fn drive<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    execution: &mut ExpressionExecution<'gc>,
) -> Result<(), EvaluationError> {
    for _ in 0..20_000 {
        if execution.step(mc)? {
            return Ok(());
        }
    }
    Err(EvaluationError::InvalidState)
}

fn json_serialize<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    value: Value<'gc>,
) -> Result<Option<String>, EvaluationError> {
    let mut execution = ExpressionExecution::serialize(
        mc,
        value,
        Environment::new(mc, None, vec![]),
        Origin { start: 0, end: 0 },
    );
    drive(mc, &mut execution)?;
    match execution.result().unwrap().raw() {
        Value::Undefined => Ok(None),
        Value::String(text) => text
            .to_utf8()
            .map(Some)
            .map_err(|_| EvaluationError::Native("isolated surrogate in JSON text".into())),
        other => Err(EvaluationError::Native(format!(
            "json result was {}",
            other.runtime_type()
        ))),
    }
}

fn collect_array<'gc>(
    mc: &uffda_heap::Mutation<'gc>,
    value: Value<'gc>,
) -> Result<Vec<Value<'gc>>, EvaluationError> {
    let mut execution = ExpressionExecution::collect_iterable(
        mc,
        value,
        Environment::new(mc, None, vec![]),
        Origin { start: 0, end: 0 },
    )?;
    drive(mc, &mut execution)?;
    match execution.result().unwrap().raw() {
        Value::Array(items) => Ok(items.borrow().clone()),
        other => Err(EvaluationError::Native(format!(
            "collect result was {}",
            other.runtime_type()
        ))),
    }
}

#[test]
// req:any-001 req:then-001 req:equal-003 req:equal-004 req:runtime-core-004 req:runtime-core-005
fn scope_port_match_spans_record_consumption_and_exhaustion() {
    // SCOPE00: two items of "abc" succeed and leave input.
    assert_span(
        Pattern::Then {
            patterns: vec![Pattern::Any, Pattern::Any],
        },
        json!("abc"),
        InputMode::Iterable,
        MatchKind::Ok,
        0,
        2,
    );
    // SCOPE01: equal consumes the matching item and leaves the rest.
    assert_span(
        literal(json!("a")),
        json!("ab"),
        InputMode::Iterable,
        MatchKind::Ok,
        0,
        1,
    );
    // SCOPE02: consuming every iterable item exhausts the input.
    assert_span(
        Pattern::Then {
            patterns: vec![Pattern::Any, Pattern::Any, Pattern::Any],
        },
        json!("abc"),
        InputMode::Iterable,
        MatchKind::Ok,
        0,
        3,
    );
    // SCOPE05: a failed equal stays at the incoming position.
    assert_span(
        literal(json!("x")),
        json!("a"),
        InputMode::Iterable,
        MatchKind::Fail,
        0,
        0,
    );
    // SCOPE06: scalar mode is one item, so equal of the whole string exhausts it.
    assert_span(
        literal(json!("abc")),
        json!("abc"),
        InputMode::Scalar,
        MatchKind::Ok,
        0,
        1,
    );
}

#[test]
// req:resolve-001 req:expressions-runtime-005
fn scope_port_patterns_do_not_resolve_globals_and_expressions_do() {
    let mut runtime = Runtime::for_pattern(
        Pattern::Resolve {
            target_kind: ResolveTargetKind::Reference,
            name: Some("id".into()),
            args: vec![],
            value: None,
        },
        json!("a"),
        InputMode::Scalar,
    )
    .unwrap();
    assert_eq!(
        runtime.run().unwrap_err(),
        RuntimeError::UnknownRule("id".into())
    );

    rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![("x".into(), Value::Number(7.0))]);
        let mut patterns = PatternExecution::new(
            mc,
            Pattern::Resolve {
                target_kind: ResolveTargetKind::Reference,
                name: Some("x".into()),
                args: vec![],
                value: None,
            },
            vec![],
            environment,
        );
        assert!(!patterns.step(mc).unwrap());
        assert_eq!(patterns.take_request().unwrap().name.as_deref(), Some("x"));
        assert!(patterns.result().is_none());

        let mut bound = ExpressionExecution::new(
            mc,
            Expression::Reference { name: "x".into() },
            environment,
            Origin { start: 0, end: 0 },
            Value::Undefined,
        );
        drive(mc, &mut bound).unwrap();
        assert!(bound.result().unwrap().strict_eq(Value::Number(7.0)));

        let mut global = ExpressionExecution::new(
            mc,
            Expression::Reference { name: "id".into() },
            Environment::new(mc, None, vec![]),
            Origin { start: 0, end: 0 },
            Value::Undefined,
        );
        drive(mc, &mut global).unwrap();
        assert!(
            global
                .result()
                .unwrap()
                .strict_eq(Value::Native(NativeGlobal::Id))
        );
    });
}

#[test]
// req:error-recovery-001
fn scope_port_recovery_defaults_off_and_propagates_through_derived_execution() {
    rootless_mutate(|mc| {
        let recovery = RecoveryContext::new(mc);
        assert!(!recovery.is_enabled());
        assert!(!recovery.disable().is_enabled());
        assert!(!recovery.was_reached());

        let enabled = recovery.enable();
        assert!(enabled.is_enabled());
        assert!(!recovery.is_enabled());
        enabled.record_failure(mc);
        assert!(recovery.was_reached());
        assert!(enabled.disable().was_reached());

        let environment = Environment::new(mc, None, vec![]);
        let mut plain = PatternExecution::new(mc, Pattern::Ok, vec![], environment);
        while !plain.step(mc).unwrap() {}
        assert!(!plain.result().unwrap().recovery.is_enabled());

        let derived = Environment::new(
            mc,
            Some(environment),
            vec![("x".into(), Value::Number(1.0))],
        );
        let mut carried = PatternExecution::new_with_recovery(
            mc,
            Pattern::Ok,
            vec![Value::string(mc, "a")],
            derived,
            enabled,
        );
        while !carried.step(mc).unwrap() {}
        let result = carried.result().unwrap();
        assert!(result.recovery.is_enabled());
        assert!(result.recovery.was_reached());
        assert!(derived.get("x").unwrap().strict_eq(Value::Number(1.0)));
    });
}

#[test]
// req:runtime-memory-004 req:runtime-core-010 req:runtime-core-011
fn scope_port_variable_layers_shadow_without_mutating_ancestors() {
    rootless_mutate(|mc| {
        let caller = Environment::new(mc, None, vec![("x".into(), Value::Number(1.0))]);
        let declared = Environment::new(mc, None, vec![]);
        assert!(declared.get("x").is_none());
        assert_ne!(declared.identity(), caller.identity());

        let argument = Environment::new(mc, Some(caller), vec![]);
        assert!(argument.get("x").unwrap().strict_eq(Value::Number(1.0)));
        assert!(argument.is_descendant_of(caller));
        assert!(!caller.is_descendant_of(argument));

        let layered = Environment::new(
            mc,
            Some(caller),
            vec![
                ("b".into(), Value::Number(2.0)),
                ("x".into(), Value::Undefined),
            ],
        );
        assert!(layered.get("x").unwrap().strict_eq(Value::Undefined));
        assert!(layered.get("b").unwrap().strict_eq(Value::Number(2.0)));
        assert!(caller.get("x").unwrap().strict_eq(Value::Number(1.0)));
        assert!(caller.get("b").is_none());
        assert_ne!(layered.identity(), caller.identity());

        let mut deep = Environment::new(mc, None, vec![("v0".into(), Value::Number(0.0))]);
        for index in 1..50 {
            deep = Environment::new(
                mc,
                Some(deep),
                vec![(format!("v{index}").into(), Value::Number(index as f64))],
            );
        }
        for index in 0..50 {
            assert!(
                deep.get(&format!("v{index}"))
                    .unwrap()
                    .strict_eq(Value::Number(index as f64))
            );
        }
        assert!(deep.get("missing").is_none());
    });
}

#[test]
// req:standard-library-001
fn scope_port_global_metadata_signatures_describe_invocation_shape() {
    assert_eq!(NativeGlobal::Add.format_signature(), "(add left right)");
    assert_eq!(NativeGlobal::Flat.format_signature(), "(flat self depth?)");
    assert_eq!(
        NativeGlobal::Format.format_signature(),
        "(format value ...args)"
    );
    assert_eq!(
        NativeGlobal::Coalesce.format_signature(),
        "(coalesce ...values)"
    );
    let metadata = globals::metadata_of("add").unwrap();
    assert_eq!(metadata.description, "Adds two numbers.");
    assert_eq!(metadata.parameters.len(), 2);
    assert_eq!(metadata.parameters[0].name, "left");
    assert!(!metadata.parameters[0].optional);
    assert!(!metadata.parameters[0].rest);
    assert_eq!(metadata.parameters[1].name, "right");
    assert!(globals::metadata_of("missing").is_none());
}

#[test]
// req:runtime-core-007 req:expressions-runtime-002
fn scope_port_expression_exceptions_surface_as_runtime_errors() {
    assert_eq!(
        RuntimeError::Expression(EvaluationError::Native("boom".into())).to_string(),
        "rule expression exception: boom"
    );
    assert_eq!(
        RuntimeError::Expression(EvaluationError::Native("42".into())).to_string(),
        "rule expression exception: 42"
    );

    let mut runtime = Runtime::for_pattern(
        Pattern::Projection {
            pattern: Box::new(Pattern::Ok),
            expression: Box::new(Expression::Reference {
                name: "missing".into(),
            }),
        },
        json!(""),
        InputMode::Scalar,
    )
    .unwrap();
    assert!(matches!(
        runtime.run().unwrap_err(),
        RuntimeError::Pattern(crate::pattern::PatternError::Expression(error))
            if matches!(error.as_ref(), EvaluationError::UnknownReference(name) if name == "missing")
    ));
}

#[test]
// req:resolve-001 req:indirect-left-recursion-001
fn scope_port_runtime_errors_have_messages_and_no_left_recursion_code() {
    let errors = [
        RuntimeError::UnknownRule("Main".into()),
        RuntimeError::NotRule("Main".into()),
        RuntimeError::InvalidArguments("bad arguments".into()),
        RuntimeError::InvalidState,
        RuntimeError::Pattern(crate::pattern::PatternError::InvalidState),
        RuntimeError::Expression(EvaluationError::Native("boom".into())),
        RuntimeError::Module("missing module".into()),
        RuntimeError::Decorator("decorator failed".into()),
    ];
    for error in errors {
        let message = error.to_string();
        assert!(!message.is_empty());
        assert!(!message.contains("E_INDIRECT_LEFT_RECURSION"));
        assert!(!format!("{error:?}").contains("E_INDIRECT_LEFT_RECURSION"));
    }
    let unknown = RuntimeError::UnknownRule("Main".into()).to_string();
    assert!(unknown.contains("Main"));
    assert!(unknown.contains("unknown rule reference"));
}

#[test]
// req:runtime-core-012
fn scope_port_conversion_rejects_callables_and_composites() {
    rootless_mutate(|mc| {
        let environment = Environment::new(mc, None, vec![]);
        let callable = lambda(
            mc,
            environment,
            Expression::Value {
                value: Some(json!("hidden").into()),
            },
        );
        let origin = Origin { start: 0, end: 1 };
        assert_eq!(
            string_text(callable),
            Err(StringCoercionError::CallableConversion)
        );
        for value in [
            callable,
            Value::array(mc, vec![callable]),
            Value::array(mc, vec![Value::array(mc, vec![callable])]),
        ] {
            assert_eq!(
                json_serialize(mc, value).unwrap_err(),
                EvaluationError::Native("cannot serialize callable to JSON".into())
            );
        }
        assert_eq!(
            string_text(Value::array(mc, vec![callable])),
            Err(StringCoercionError::CompositeConversion)
        );
        assert_eq!(
            json_serialize(mc, Value::object(mc, vec![("callable".into(), callable)])).unwrap_err(),
            EvaluationError::Native("cannot serialize callable to JSON".into())
        );
        assert_eq!(
            json_serialize(mc, callable.wrap(mc, origin)).unwrap_err(),
            EvaluationError::Native("cannot serialize callable to JSON".into())
        );

        let returns_callable = lambda(mc, environment, Expression::Reference { name: "id".into() });
        assert_eq!(
            json_serialize(
                mc,
                Value::object(mc, vec![("toJSON".into(), returns_callable)])
            )
            .unwrap_err(),
            EvaluationError::Native("cannot serialize callable to JSON".into())
        );

        let returns_object = lambda(
            mc,
            environment,
            Expression::Object {
                keys: vec![ObjectInitializer::ObjectKey {
                    name: "answer".into(),
                    expression: Expression::Number { value: 42.0 },
                }],
            },
        );
        assert_eq!(
            json_serialize(
                mc,
                Value::object(mc, vec![("toJSON".into(), returns_object)])
            )
            .unwrap()
            .as_deref(),
            Some(r#"{"answer":42}"#)
        );
        assert_eq!(
            json_serialize(mc, Value::array(mc, vec![Value::Undefined]))
                .unwrap()
                .as_deref(),
            Some("[null]")
        );
        assert_eq!(json_serialize(mc, Value::Undefined).unwrap(), None);
        assert_eq!(
            json_serialize(
                mc,
                Value::object(
                    mc,
                    vec![(
                        "a".into(),
                        Value::array(
                            mc,
                            vec![Value::Number(1.0), Value::Null, Value::string(mc, "a"),],
                        ),
                    )],
                )
            )
            .unwrap()
            .as_deref(),
            Some(r#"{"a":[1,null,"a"]}"#)
        );

        for value in [
            Value::object(mc, vec![]),
            Value::array(mc, vec![]),
            Value::map(mc, vec![]),
            Value::set(mc, vec![]),
            Value::Url(uffda_heap::Gc::new(
                mc,
                crate::value::RuntimeUrl(url::Url::parse("https://example.com").unwrap()),
            )),
        ] {
            assert_eq!(
                string_text(value),
                Err(StringCoercionError::CompositeConversion)
            );
        }
        assert_eq!(string_text(Value::Number(42.0)).unwrap(), "42");
        assert_eq!(string_text(Value::Boolean(true)).unwrap(), "true");
        assert_eq!(string_text(Value::Null).unwrap(), "null");
        assert_eq!(string_text(Value::Undefined).unwrap(), "undefined");
        assert_eq!(
            string_text(Value::bigint(mc, num_bigint::BigInt::from(1))).unwrap(),
            "1"
        );
        assert_eq!(string_text(Value::string(mc, "a")).unwrap(), "a");
    });
}

#[test]
// req:runtime-memory-001 req:runtime-strings-002
fn scope_port_collect_drains_sync_collections_and_keeps_item_provenance() {
    rootless_mutate(|mc| {
        let numbers = collect_array(
            mc,
            Value::array(
                mc,
                vec![Value::Number(1.0), Value::Number(2.0), Value::Number(3.0)],
            ),
        )
        .unwrap();
        assert!(numbers[0].strict_eq(Value::Number(1.0)));
        assert!(numbers[1].strict_eq(Value::Number(2.0)));
        assert!(numbers[2].strict_eq(Value::Number(3.0)));

        let set = collect_array(
            mc,
            Value::set(mc, vec![Value::Number(1.0), Value::Number(2.0)]),
        )
        .unwrap();
        assert!(set[0].strict_eq(Value::Number(1.0)));
        assert!(set[1].strict_eq(Value::Number(2.0)));

        let chars = collect_array(mc, Value::string(mc, "ab")).unwrap();
        assert_eq!(string_text(chars[0]).unwrap(), "a");
        assert_eq!(string_text(chars[1]).unwrap(), "b");

        assert!(matches!(
            collect_array(mc, Value::Number(42.0)),
            Err(EvaluationError::Native(message)) if message.contains("Symbol.iterator")
        ));

        let item = Value::Number(1.0).wrap(mc, Origin { start: 2, end: 3 });
        let drained = collect_array(
            mc,
            Value::array(mc, vec![item, Value::Number(2.0)]).wrap(mc, Origin { start: 0, end: 3 }),
        )
        .unwrap();
        assert!(drained[0].same_wrapper(item));
        assert!(drained[1].raw().strict_eq(Value::Number(2.0)));
        assert!(drained[1].origin().is_some());

        let text = concatenate(
            mc,
            &[
                Value::string(mc, "a").wrap(mc, Origin { start: 4, end: 5 }),
                Value::string(mc, "b"),
            ],
            Origin { start: 9, end: 10 },
        )
        .unwrap();
        let chars = collect_array(mc, text).unwrap();
        assert_eq!(chars[0].origin(), Some(Origin { start: 4, end: 5 }));
        assert_eq!(chars[1].origin(), Some(Origin { start: 9, end: 10 }));
    });
}

#[test]
// req:runtime-memory-004
fn scope_port_variable_scope_layers_keep_undefined_and_share_ancestors() {
    rootless_mutate(|mc| {
        let empty = Environment::new(mc, None, vec![]);
        assert!(empty.get("a").is_none());
        assert_ne!(
            Environment::new(mc, Some(empty), vec![]).identity(),
            empty.identity()
        );

        let base = Environment::new(mc, None, vec![("a".into(), Value::Number(1.0))]);
        let layered = Environment::new(mc, Some(base), vec![("b".into(), Value::Number(2.0))]);
        assert!(layered.get("a").unwrap().strict_eq(Value::Number(1.0)));
        assert!(layered.get("b").unwrap().strict_eq(Value::Number(2.0)));
        assert!(layered.get("c").is_none());
        assert!(base.get("b").is_none());
        assert!(layered.is_descendant_of(base));
        assert!(!base.is_descendant_of(layered));

        let shadowed = Environment::new(mc, Some(base), vec![("a".into(), Value::Number(2.0))]);
        assert!(shadowed.get("a").unwrap().strict_eq(Value::Number(2.0)));
        assert!(base.get("a").unwrap().strict_eq(Value::Number(1.0)));

        let present = Environment::new(mc, None, vec![("x".into(), Value::Undefined)]);
        assert!(present.get("x").unwrap().strict_eq(Value::Undefined));
        assert!(present.get("missing").is_none());

        let derived = Environment::new(
            mc,
            Some(base),
            vec![
                ("b".into(), Value::Number(2.0)),
                ("a".into(), Value::Number(3.0)),
            ],
        );
        assert!(derived.is_descendant_of(base));
        assert!(derived.get("a").unwrap().strict_eq(Value::Number(3.0)));
        assert!(derived.get("b").unwrap().strict_eq(Value::Number(2.0)));
        assert!(base.get("a").unwrap().strict_eq(Value::Number(1.0)));

        let unrelated = Environment::new(
            mc,
            None,
            vec![
                ("a".into(), Value::Number(2.0)),
                ("b".into(), Value::Number(3.0)),
            ],
        );
        assert!(!unrelated.is_descendant_of(base));
        assert!(base.get("b").is_none());
        let folded = Environment::new(
            mc,
            Some(base),
            vec![
                ("a".into(), Value::Number(2.0)),
                ("b".into(), Value::Number(3.0)),
            ],
        );
        assert!(folded.get("a").unwrap().strict_eq(Value::Number(2.0)));
        assert!(folded.get("b").unwrap().strict_eq(Value::Number(3.0)));
        assert!(base.get("b").is_none());
        assert!(folded.is_descendant_of(base));

        let mut deep = Environment::new(mc, None, vec![]);
        for index in 0..50 {
            deep = Environment::new(
                mc,
                Some(deep),
                vec![(format!("v{index}").into(), Value::Number(index as f64))],
            );
        }
        for index in 0..50 {
            assert!(
                deep.get(&format!("v{index}"))
                    .unwrap()
                    .strict_eq(Value::Number(index as f64))
            );
        }
        assert_eq!(deep.ancestors().count(), 51);
    });
}

fn compile_scope_module(
    module: serde_json::Value,
) -> (std::rc::Rc<crate::module::CompiledModuleGraph>, url::Url) {
    let url = url::Url::parse("file:///scope-port.json").unwrap();
    let mut resolver = crate::resolver::Resolver::from_cwd().unwrap();
    resolver.insert_declaration(
        url.clone(),
        crate::resolver::decode_declaration(&url, &module.to_string()).unwrap(),
    );
    (
        std::rc::Rc::new(
            crate::module::CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap())
                .unwrap(),
        ),
        url,
    )
}

fn reference_pattern(name: &str, args: serde_json::Value) -> serde_json::Value {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":args})
}

fn until_host(runtime: &mut Runtime) {
    for _ in 0..10_000 {
        match runtime.step_status().unwrap() {
            crate::evaluate::StepStatus::Suspended => return,
            crate::evaluate::StepStatus::Complete => panic!("expected a host suspension"),
            crate::evaluate::StepStatus::Yielded => {}
        }
    }
    panic!("host suspension did not arrive");
}

#[test]
// req:runtime-core-009 req:runtime-core-004
fn scope_port_call_stack_shares_lower_frames() {
    let runtime = Runtime::for_pattern(Pattern::Ok, json!(""), InputMode::Scalar).unwrap();
    runtime.read(|execution| {
        assert_eq!(execution.frames.len(), 1);
        assert!(execution.frames[0].invocation.is_none());
    });

    let module = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [
            {
                "name": "Inner",
                "parameters": [],
                "pattern": {"kind":"any"},
                "expression": {
                    "kind":"invocation",
                    "expression":{"kind":"reference","name":"host"},
                    "args":[]
                }
            },
            {
                "name": "Main",
                "parameters": [],
                "pattern": {"kind":"then","patterns":[
                    reference_pattern("Inner", json!([])),
                    reference_pattern("Inner", json!([]))
                ]}
            }
        ]
    });
    let (graph, url) = compile_scope_module(module);
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!("ab"),
        InputMode::Iterable,
        vec![crate::value::HostCallable {
            id: 1,
            name: "host".into(),
            arity: 0,
        }],
    )
    .unwrap();

    let mut outer_contexts = Vec::new();
    let mut outer_environments = Vec::new();
    for expected_position in [0, 1] {
        until_host(&mut runtime);
        runtime.read(|execution| {
            assert!(execution.frames.len() >= 2);
            assert!(execution.frames[0].invocation.is_none());
            let inner = execution
                .frames
                .iter()
                .rev()
                .find(|frame| frame.invocation.is_some())
                .unwrap();
            let invocation = inner.invocation.as_ref().unwrap();
            assert_eq!(invocation.request.name.as_deref(), Some("Inner"));
            assert_eq!(invocation.request.position, expected_position);
            assert_eq!(invocation.request.stream.len(), 2);
            assert!(!invocation.request.recovery.is_enabled());
            assert!(!execution.entry.recovery.is_enabled());
            assert_eq!(
                inner.lexical_environment.identity(),
                execution
                    .bindings
                    .as_ref()
                    .unwrap()
                    .environment(&url)
                    .unwrap()
                    .identity()
            );
            outer_contexts.push(uffda_heap::Gc::as_ptr(execution.frames[0].context) as usize);
            outer_environments.push(execution.frames[0].lexical_environment.identity());
            let names: Vec<_> = execution
                .frames
                .iter()
                .filter_map(|frame| {
                    frame
                        .invocation
                        .as_ref()
                        .and_then(|invocation| invocation.request.name.clone())
                })
                .collect();
            assert_eq!(names, ["Inner"]);
        });
        let request = runtime.take_host_request().unwrap();
        runtime
            .complete_host(
                &request,
                Ok(crate::evaluate::HostCompletion::materialize(
                    vec![],
                    |mc, _| Ok(Value::string(mc, "ok")),
                )),
            )
            .unwrap();
    }
    assert_eq!(outer_contexts[0], outer_contexts[1]);
    assert_eq!(outer_environments[0], outer_environments[1]);
    loop {
        if runtime.step_status().unwrap() == crate::evaluate::StepStatus::Complete {
            break;
        }
    }
    assert_eq!(
        runtime.serialize_result().unwrap().unwrap(),
        r#"["ok","ok"]"#
    );
}

#[test]
// req:runtime-core-009 req:runtime-core-010 req:pipeline-001
fn scope_port_pipeline_keeps_bound_rule_arguments() {
    let module = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [
            {
                "name": "Use",
                "parameters": [{"name":"P"}],
                "pattern": {"kind":"pipeline","steps":[reference_pattern("P", json!([]))]}
            },
            {
                "name": "Main",
                "parameters": [],
                "pattern": reference_pattern("Use", json!([
                    {"kind":"equal","value":{"kind":"value.literal","value":"a"}}
                ]))
            }
        ]
    });
    let (graph, url) = compile_scope_module(module);
    let mut runtime =
        Runtime::with_mode(graph, &url, None, json!("a"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    assert_eq!(runtime.serialize_result().unwrap().unwrap(), r#""a""#);
}

#[test]
// req:runtime-core-010
fn scope_port_bound_arguments_shadow_declared_rules() {
    let module = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [
            {
                "name": "Local",
                "parameters": [],
                "pattern": {"kind":"equal","value":{"kind":"value.literal","value":"zz"}}
            },
            {
                "name": "Use",
                "parameters": [{"name":"Local"}],
                "pattern": reference_pattern("Local", json!([])),
                "expression": {
                    "kind":"invocation",
                    "expression":{"kind":"reference","name":"host"},
                    "args":[]
                }
            },
            {
                "name": "Main",
                "parameters": [],
                "pattern": reference_pattern("Use", json!([
                    {"kind":"equal","value":{"kind":"value.literal","value":"a"}}
                ]))
            }
        ]
    });
    let (graph, url) = compile_scope_module(module);
    assert!(graph.resolve(&url, "Local").is_some());
    let mut runtime = Runtime::with_hosts(
        graph,
        &url,
        None,
        json!("a"),
        InputMode::Iterable,
        vec![crate::value::HostCallable {
            id: 1,
            name: "host".into(),
            arity: 0,
        }],
    )
    .unwrap();
    until_host(&mut runtime);
    runtime.read(|execution| {
        let frame = execution
            .frames
            .iter()
            .rev()
            .find(|frame| {
                frame
                    .invocation
                    .as_ref()
                    .is_some_and(|invocation| invocation.request.name.as_deref() == Some("Use"))
            })
            .unwrap();
        let invocation = frame.invocation.as_ref().unwrap();
        assert_eq!(invocation.request.stream.len(), 1);
        assert_eq!(invocation.request.position, 0);
        let arguments = &execution.targets[invocation.target].context().arguments;
        assert_eq!(arguments.len(), 1);
        assert_eq!(arguments[0].0, "Local");
        assert!(matches!(
            execution.targets[arguments[0].1],
            Target::Inline { .. }
        ));
        assert!(frame.lexical_environment.get("not-from-caller").is_none());
    });
    let request = runtime.take_host_request().unwrap();
    runtime
        .complete_host(
            &request,
            Ok(crate::evaluate::HostCompletion::materialize(
                vec![],
                |mc, _| Ok(Value::string(mc, "arg")),
            )),
        )
        .unwrap();
    runtime.run().unwrap();
    assert_eq!(runtime.serialize_result().unwrap().unwrap(), r#""arg""#);
}

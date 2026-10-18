//! Selective memoization ports (Deno `rule.reentrancy` REENTRANCY cases).

use super::{InputMode, Runtime};
use crate::module::CompiledModuleGraph;
use crate::resolver::graph::ModuleMember;
use crate::resolver::{Resolver, decode_declaration};
use serde_json::{Value as Json, json};
use std::rc::Rc;
use url::Url;

fn compile_one(module: Json) -> (Rc<CompiledModuleGraph>, Url) {
    let mut resolver = Resolver::from_cwd().unwrap();
    let entry = Url::parse("file:///selective-memo.json").unwrap();
    resolver.insert_declaration(
        entry.clone(),
        decode_declaration(&entry, &module.to_string()).unwrap(),
    );
    (
        Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&entry).unwrap()).unwrap()),
        entry,
    )
}

fn character() -> Json {
    json!({"kind":"character","characterClass":"L"})
}

fn resolve_ref(name: &str) -> Json {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":[]})
}

fn resolve_ref_args(name: &str, args: Vec<Json>) -> Json {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":args})
}

fn rule(name: &str, pattern: Json) -> Json {
    json!({"name":name,"parameters":[],"pattern":pattern})
}

fn rule_with_params(name: &str, parameters: Vec<&str>, pattern: Json) -> Json {
    json!({
        "name": name,
        "parameters": parameters.into_iter().map(|name| json!({"name": name})).collect::<Vec<_>>(),
        "pattern": pattern
    })
}

fn module_with(rules: Vec<Json>) -> Json {
    json!({
        "imports": [],
        "exports": [{"kind":"rule","name": rules[0]["name"], "default": true}],
        "rules": rules,
    })
}

fn skip(graph: &CompiledModuleGraph, url: &Url, name: &str) -> bool {
    let member = graph.resolve(url, name).expect("rule resolves");
    graph.can_skip_memo(&member)
}

fn member(graph: &CompiledModuleGraph, url: &Url, name: &str) -> ModuleMember {
    graph.resolve(url, name).expect("rule resolves")
}

#[test]
// req:selective-memoization-001
fn reentrancy00_leaf_rule_with_no_calls_is_safe_to_skip_memo_for() {
    let (graph, url) = compile_one(module_with(vec![rule("leaf", character())]));
    assert!(skip(&graph, &url, "leaf"));
}

#[test]
// req:selective-memoization-001
fn reentrancy01_rule_that_only_calls_a_non_cyclic_rule_is_safe_too() {
    let (graph, url) = compile_one(module_with(vec![
        rule("leaf", character()),
        rule("wrapper", resolve_ref("leaf")),
    ]));
    assert!(skip(&graph, &url, "leaf"));
    assert!(skip(&graph, &url, "wrapper"));
}

#[test]
// req:selective-memoization-002
fn reentrancy02_directly_self_recursive_rule_must_stay_memoized() {
    let (graph, url) = compile_one(module_with(vec![
        rule(
            "group",
            json!({"kind":"or","patterns":[resolve_ref("leaf"), resolve_ref("group")]}),
        ),
        rule("leaf", character()),
    ]));
    assert!(!skip(&graph, &url, "group"));
}

#[test]
// req:selective-memoization-002
fn reentrancy03_mutually_recursive_rules_must_both_stay_memoized() {
    let (graph, url) = compile_one(module_with(vec![
        rule("a", resolve_ref("b")),
        rule("b", resolve_ref("a")),
    ]));
    assert!(!skip(&graph, &url, "a"));
    assert!(!skip(&graph, &url, "b"));
}

#[test]
// req:selective-memoization-001 req:selective-memoization-002
fn reentrancy04_rule_reached_only_via_a_cycle_elsewhere_is_unaffected() {
    // a -> b -> c -> b (b/c cycle does not involve a)
    let (graph, url) = compile_one(module_with(vec![
        rule("a", resolve_ref("b")),
        rule("b", resolve_ref("c")),
        rule("c", resolve_ref("b")),
    ]));
    assert!(skip(&graph, &url, "a"));
    assert!(!skip(&graph, &url, "b"));
    assert!(!skip(&graph, &url, "c"));
}

#[test]
// req:selective-memoization-002
fn reentrancy05_parameterized_rule_is_conservatively_never_skipped() {
    let (graph, url) = compile_one(module_with(vec![rule_with_params(
        "generic",
        vec!["x"],
        character(),
    )]));
    assert!(!skip(&graph, &url, "generic"));
}

#[test]
// req:selective-memoization-002
fn reentrancy06_call_passing_rule_valued_arguments_is_dynamic() {
    let (graph, url) = compile_one(module_with(vec![
        rule("leaf", character()),
        rule("caller", resolve_ref_args("leaf", vec![character()])),
    ]));
    assert!(!skip(&graph, &url, "caller"));
}

#[test]
// req:selective-memoization-002
fn reentrancy07_resolve_run_is_dynamic() {
    let (graph, url) = compile_one(module_with(vec![rule(
        "caller",
        json!({"kind":"resolve","targetKind":"run","args":[]}),
    )]));
    assert!(!skip(&graph, &url, "caller"));
}

#[test]
// req:selective-memoization-002
fn reentrancy08_unresolved_reference_name_is_treated_conservatively() {
    let (graph, url) = compile_one(module_with(vec![rule("caller", resolve_ref("missing"))]));
    assert!(!skip(&graph, &url, "caller"));
}

#[test]
// req:selective-memoization-001
fn reentrancy09_special_rule_reference_is_a_concrete_call_edge() {
    let (graph, url) = compile_one(module_with(vec![
        rule("leaf", character()),
        rule(
            "caller",
            json!({
                "kind":"resolve",
                "targetKind":"special",
                "value":{"kind":"rule","pattern":{"kind":"character","characterClass":"L"}}
            }),
        ),
    ]));
    assert!(skip(&graph, &url, "caller"));
}

#[test]
// req:selective-memoization-002
fn reentrancy10_deeply_nested_structural_patterns_are_traversed() {
    let nested = json!({
        "kind":"then",
        "patterns":[{
            "kind":"maybe",
            "pattern":{
                "kind":"quantifier",
                "pattern": resolve_ref("group")
            }
        }]
    });
    let (graph, url) = compile_one(module_with(vec![
        rule("leaf", character()),
        rule(
            "group",
            json!({
                "kind":"switch",
                "cases":[{
                    "key":{"kind":"characterClass","characterClass":"L"},
                    "pattern": resolve_ref("leaf")
                }],
                "default": nested
            }),
        ),
    ]));
    assert!(!skip(&graph, &url, "group"));
    assert!(skip(&graph, &url, "leaf"));
}

#[test]
// req:selective-memoization-001 req:selective-memoization-002
fn reentrancy11_recover_traverses_its_child_and_its_skip_pattern() {
    let (graph, url) = compile_one(module_with(vec![
        rule("leaf", character()),
        rule(
            "viaChild",
            json!({
                "kind":"recover",
                "pattern": resolve_ref("viaChild"),
                "skip": resolve_ref("leaf")
            }),
        ),
        rule(
            "viaSkip",
            json!({
                "kind":"recover",
                "pattern": resolve_ref("leaf"),
                "skip": resolve_ref("viaSkip")
            }),
        ),
        rule(
            "neither",
            json!({
                "kind":"recover",
                "pattern": resolve_ref("leaf"),
                "skip": resolve_ref("leaf")
            }),
        ),
    ]));
    assert!(!skip(&graph, &url, "viaChild"));
    assert!(!skip(&graph, &url, "viaSkip"));
    assert!(skip(&graph, &url, "neither"));
}

#[test]
// req:selective-memoization-002
fn reentrancy12_over_traverses_both_rest_entry_patterns() {
    let (graph, url) = compile_one(module_with(vec![
        rule(
            "keyRecursive",
            json!({
                "kind":"over",
                "keys":{},
                "rest":[{
                    "kind":"pattern",
                    "key": resolve_ref("keyRecursive"),
                    "value": character()
                }]
            }),
        ),
        rule(
            "valueRecursive",
            json!({
                "kind":"over",
                "keys":{},
                "rest":[{
                    "kind":"pattern",
                    "key": character(),
                    "value": resolve_ref("valueRecursive")
                }]
            }),
        ),
    ]));
    assert!(!skip(&graph, &url, "keyRecursive"));
    assert!(!skip(&graph, &url, "valueRecursive"));
}

#[test]
// req:selective-memoization-001
fn skip_memo_invocation_does_not_populate_the_memo_table() {
    let (graph, url) = compile_one(module_with(vec![rule("leaf", character())]));
    assert!(graph.can_skip_memo(&member(&graph, &url, "leaf")));
    let mut runtime =
        Runtime::with_mode(graph, &url, Some("leaf"), json!("a"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(
            execution.memos.is_empty(),
            "skip-memo leaf must not populate packrat memos"
        );
        assert_eq!(execution.memo_hits(), 0);
        let result = execution.result().expect("match");
        // Root resolve wraps the rule result; origin is on the rule-tagged child.
        let mut found_origin = result.rule.is_some();
        let mut pending: Vec<_> = result.children.iter().copied().collect();
        while let Some(node) = pending.pop() {
            if node.rule.is_some() {
                found_origin = true;
                break;
            }
            pending.extend(node.children.iter().copied());
        }
        assert!(
            found_origin,
            "match origin must still carry the rule identity"
        );
    });
}

#[test]
// req:selective-memoization-001 req:selective-memoization-002
fn left_recursive_rules_still_grow_via_memoization() {
    let (graph, url) = compile_one(module_with(vec![
        rule(
            "group",
            json!({"kind":"or","patterns":[resolve_ref("letter"), resolve_ref("group")]}),
        ),
        rule("letter", character()),
    ]));
    assert!(!skip(&graph, &url, "group"));
    assert!(skip(&graph, &url, "letter"));
    let mut runtime = Runtime::with_mode(
        graph,
        &url,
        Some("group"),
        json!("abc"),
        InputMode::Iterable,
    )
    .unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert!(
            !execution.memos.is_empty() || execution.body_attempts() > 0,
            "left-recursive group must still use the memoized growth path"
        );
        // letter is skip-memo; only group entries should remain after a completed parse
        // (eviction may clear them). Body attempts prove growth ran.
        assert!(execution.body_attempts() >= 1);
    });
}

#[test]
// req:selective-memoization-001 req:selective-memoization-002
fn skip_memo_parent_of_left_recursive_child_still_matches() {
    let eq = |value: &str| json!({"kind":"equal","value":{"kind":"value.literal","value":value}});
    let (graph, url) = compile_one(module_with(vec![
        rule("Main", resolve_ref("R")),
        rule(
            "R",
            json!({"kind":"or","patterns":[resolve_ref("R"), eq("x")]}),
        ),
    ]));
    assert!(skip(&graph, &url, "Main"));
    assert!(!skip(&graph, &url, "R"));
    let mut runtime =
        Runtime::with_mode(graph, &url, Some("Main"), json!("x"), InputMode::Iterable).unwrap();
    runtime.run().unwrap();
    runtime.read(|execution| {
        assert_eq!(
            execution.result().unwrap().kind,
            crate::pattern::MatchKind::Ok,
            "skip-memo parent must not break LR child"
        );
    });
}

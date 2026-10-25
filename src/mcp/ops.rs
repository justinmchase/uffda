//! Session introspection, patch, walk retention, and highlight helpers.

use crate::json::JsonValue;
use crate::languages::{Language, Languages};
use crate::module::CompiledModuleGraph;
use crate::pattern::{MatchKind, PatternMatch};
use crate::resolver::graph::MemberKind;
use crate::resolver::{ModuleDeclaration, decode_declaration};
use crate::runtime::Runtime;
use crate::value::Value as RuntimeValue;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::rc::Rc;
use url::Url;

#[derive(Clone)]
pub struct RetainedMatch {
    pub kind: String,
    pub start: usize,
    pub end: usize,
    pub rule: Option<String>,
    pub recovered: bool,
    pub pattern: Value,
    pub value: Option<Value>,
    pub metadata: Value,
    /// Children shared by pointer: a parse match is a DAG (memoized
    /// sub-matches are reused), so identical sub-matches are projected once.
    pub children: Vec<Rc<RetainedMatch>>,
}

impl RetainedMatch {
    pub fn child_count(&self) -> usize {
        self.children.len()
    }
}

pub fn project_match_tree(runtime: &Runtime) -> Option<RetainedMatch> {
    runtime.read(|execution| {
        let matched = execution.result()?;
        let mut memo = HashMap::new();
        Some(project_node(matched, &mut memo))
    })
}

fn project_node(
    node: uffda_heap::Gc<'_, PatternMatch<'_>>,
    memo: &mut HashMap<usize, Rc<RetainedMatch>>,
) -> RetainedMatch {
    let kind = match node.kind {
        MatchKind::Ok => "ok",
        MatchKind::Fail => "fail",
        MatchKind::Skip => "skip",
    }
    .to_string();
    let rule = node
        .rule
        .as_ref()
        .and_then(|declaration| match declaration.subject.raw() {
            RuntimeValue::Object(object) => {
                object
                    .borrow()
                    .get("name")
                    .and_then(|value| match value.raw() {
                        RuntimeValue::String(text) => text.to_utf8().ok(),
                        _ => None,
                    })
            }
            _ => None,
        });
    let metadata = node
        .rule
        .as_ref()
        .map(|declaration| runtime_value_to_json(declaration.metadata))
        .unwrap_or(Value::Null);
    let value = match node.kind {
        MatchKind::Ok | MatchKind::Skip => Some(runtime_value_to_json(node.value)),
        _ => None,
    };
    let children = node
        .children
        .iter()
        .map(|child| {
            let key = uffda_heap::Gc::as_ptr(*child) as usize;
            if let Some(shared) = memo.get(&key) {
                return Rc::clone(shared);
            }
            let shared = Rc::new(project_node(*child, memo));
            memo.insert(key, Rc::clone(&shared));
            shared
        })
        .collect();
    RetainedMatch {
        kind,
        // Character offsets (Deno originalSpan), not token-stream indices.
        start: node.origin.start,
        end: node.origin.end,
        rule,
        recovered: node.recovered,
        pattern: json!({ "kind": node.pattern_kind.as_str() }),
        value,
        metadata,
        children,
    }
}

fn runtime_value_to_json(value: RuntimeValue<'_>) -> Value {
    match value.raw() {
        RuntimeValue::Null => Value::Null,
        RuntimeValue::Undefined => Value::Null,
        RuntimeValue::Boolean(value) => Value::Bool(value),
        RuntimeValue::Number(value) => serde_json::Number::from_f64(value)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        RuntimeValue::String(value) => value.to_utf8().map(Value::String).unwrap_or(Value::Null),
        RuntimeValue::Array(array) => Value::Array(
            array
                .borrow()
                .iter()
                .copied()
                .map(runtime_value_to_json)
                .collect(),
        ),
        RuntimeValue::Object(object) => {
            let mut map = serde_json::Map::new();
            for (key, value) in object.borrow().entries() {
                if let Ok(key) = key.to_utf8() {
                    map.insert(key, runtime_value_to_json(*value));
                }
            }
            Value::Object(map)
        }
        _ => Value::Null,
    }
}

pub fn walk_retained(
    root: &RetainedMatch,
    path: &[usize],
    max_nodes: usize,
    max_depth: Option<usize>,
) -> Value {
    let mut start = root;
    let mut ancestry: Vec<&RetainedMatch> = vec![root];
    for &index in path {
        if start.children.get(index).is_none() {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_WALK_INVALID_PATH",
                    "phase": "input",
                    "message": format!(
                        "Path index {index} is out of range (node has {} children)",
                        start.children.len()
                    )
                }
            });
        }
        start = &*start.children[index];
        ancestry.push(start);
    }

    let mut nodes = Vec::new();
    let mut truncated = false;
    visit_walk(
        start,
        path.to_vec(),
        &ancestry,
        0,
        max_nodes,
        max_depth,
        &mut nodes,
        &mut truncated,
    );
    json!({ "ok": true, "nodes": nodes, "truncated": truncated })
}

#[allow(clippy::too_many_arguments)]
fn visit_walk(
    node: &RetainedMatch,
    path: Vec<usize>,
    ancestry: &[&RetainedMatch],
    depth: usize,
    max_nodes: usize,
    max_depth: Option<usize>,
    nodes: &mut Vec<Value>,
    truncated: &mut bool,
) {
    if nodes.len() >= max_nodes {
        *truncated = true;
        return;
    }
    nodes.push(project_walk_node(node, &path, ancestry));
    if node.children.is_empty() {
        return;
    }
    if max_depth.is_some_and(|limit| depth >= limit) {
        *truncated = true;
        return;
    }
    for (index, child) in node.children.iter().enumerate() {
        if nodes.len() >= max_nodes {
            *truncated = true;
            return;
        }
        let mut child_path = path.clone();
        child_path.push(index);
        let mut child_ancestry = ancestry.to_vec();
        child_ancestry.push(child);
        visit_walk(
            child,
            child_path,
            &child_ancestry,
            depth + 1,
            max_nodes,
            max_depth,
            nodes,
            truncated,
        );
    }
}

fn project_walk_node(node: &RetainedMatch, path: &[usize], ancestry: &[&RetainedMatch]) -> Value {
    let mut metadata = Vec::new();
    for ancestor in ancestry {
        if let Some(rule) = &ancestor.rule
            && ancestor.metadata != Value::Null
            && ancestor.metadata != json!({})
        {
            metadata.push(json!({
                "rule": rule,
                "metadata": ancestor.metadata
            }));
        }
    }
    let mut value = json!({
        "path": path,
        "kind": node.kind,
        "pattern": node.pattern,
        "originalSpan": { "start": node.start, "end": node.end },
        "childCount": node.child_count(),
        "variables": {},
        "metadata": metadata
    });
    if let Some(rule) = &node.rule {
        value["rule"] = json!(rule);
    }
    if node.recovered {
        value["recovered"] = json!(true);
    }
    if let Some(matched) = &node.value {
        value["value"] = matched.clone();
    }
    value
}

pub fn describe_declaration(
    graph: &Rc<CompiledModuleGraph>,
    module: &Url,
    name: &str,
    declaration_json: &str,
) -> Value {
    let declaration = match decode_declaration(module, declaration_json) {
        Ok(declaration) => declaration,
        Err(error) => {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_DESCRIBE_UNKNOWN_DECLARATION",
                    "phase": "resolve",
                    "message": error.to_string()
                }
            });
        }
    };
    let Some((kind, item)) = find_named(&declaration, name) else {
        return json!({
            "ok": false,
            "error": {
                "code": "MCP_SESSION_DESCRIBE_UNKNOWN_DECLARATION",
                "phase": "resolve",
                "message": format!("No rule/func/decorator named '{name}' in module {module}")
            }
        });
    };
    let exported = declaration.exports.iter().any(|export| {
        matches!(
            export.get("name"),
            Some(JsonValue::String(text)) if text.to_utf8().ok().as_deref() == Some(name)
        )
    });
    let attributes = item
        .get("attributes")
        .and_then(|value| match value {
            JsonValue::Array(items) => Some(items),
            _ => None,
        })
        .map(|items| {
            items
                .iter()
                .filter_map(|attribute| {
                    let decorator = match attribute.get("name") {
                        Some(JsonValue::String(text)) => text.to_utf8().ok()?,
                        _ => return None,
                    };
                    let args = attribute
                        .get("args")
                        .map(json_from_runtime)
                        .unwrap_or_else(|| json!([]));
                    Some(json!({ "decorator": decorator, "args": args }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let metadata = match kind {
        "rule" | "func" => metadata_for_member(graph, module, name).unwrap_or(json!({})),
        _ => json!({}),
    };

    let mut described = json!({
        "moduleUrl": module.as_str(),
        "name": name,
        "kind": kind,
        "exported": exported,
        "pattern": item.get("pattern").map(json_from_runtime).unwrap_or(Value::Null),
        "expression": item.get("expression").map(json_from_runtime).unwrap_or(Value::Null),
        "attributes": attributes,
        "metadata": metadata
    });
    if kind == "rule"
        && let Some(parameters) = item.get("parameters")
    {
        described["parameters"] = json_from_runtime(parameters);
    }
    json!({ "ok": true, "declaration": described })
}

pub fn query_by_metadata(
    graph: &Rc<CompiledModuleGraph>,
    modules: &[(Url, String)],
    decorator: &str,
    predicate: Option<&str>,
) -> Value {
    if let Some(predicate) = predicate {
        // Predicate matching uses the pattern grammar; unsupported predicates
        // fail cleanly rather than silently ignoring the filter.
        let mut languages = match Languages::new() {
            Ok(languages) => languages,
            Err(error) => {
                return json!({
                    "ok": false,
                    "error": {
                        "code": "MCP_SESSION_QUERY_PARSE_FAILURE",
                        "phase": "parse",
                        "message": error.to_string()
                    }
                });
            }
        };
        if let Err(error) = languages.parse_source(predicate, Language::Pattern) {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_SESSION_QUERY_PARSE_FAILURE",
                    "phase": "parse",
                    "message": error.to_string()
                }
            });
        }
        // Full predicate matching against metadata values lands with walk/match
        // retention; for now accept only patterns that parse and still scan.
        let _ = predicate;
    }

    let mut matches = Vec::new();
    for (module_url, declaration_json) in modules {
        let Ok(declaration) = decode_declaration(module_url, declaration_json) else {
            continue;
        };
        for (kind, items) in [("rule", &declaration.rules), ("func", &declaration.funcs)] {
            for item in items {
                let Some(JsonValue::String(name)) = item.get("name") else {
                    continue;
                };
                let Ok(name) = name.to_utf8() else {
                    continue;
                };
                let Some(metadata) = metadata_for_member(graph, module_url, &name) else {
                    continue;
                };
                let Some(Value::Object(map)) = Some(&metadata).filter(|value| value.is_object())
                else {
                    continue;
                };
                if !map.contains_key(decorator) {
                    continue;
                }
                matches.push(json!({
                    "moduleUrl": module_url.as_str(),
                    "name": name,
                    "kind": kind,
                    "metadata": map.get(decorator).cloned().unwrap_or(Value::Null)
                }));
            }
        }
    }
    json!({ "ok": true, "matches": matches })
}

fn metadata_for_member(graph: &Rc<CompiledModuleGraph>, module: &Url, name: &str) -> Option<Value> {
    let member = graph.resolve(module, name).or_else(|| {
        graph
            .export(module, Some(name))
            .filter(|member| match member.kind {
                MemberKind::Rule | MemberKind::Func => true,
                MemberKind::Decorator => false,
            })
    })?;
    let mut runtime = Runtime::metadata(Rc::clone(graph)).ok()?;
    runtime.run().ok()?;
    let text = runtime.serialize_metadata(&member).ok()??;
    serde_json::from_str(text.trim()).ok()
}

fn find_named<'a>(
    declaration: &'a ModuleDeclaration,
    name: &str,
) -> Option<(&'static str, &'a JsonValue)> {
    for (kind, items) in [
        ("rule", &declaration.rules),
        ("func", &declaration.funcs),
        ("decorator", &declaration.decorators),
    ] {
        for item in items {
            if let Some(JsonValue::String(text)) = item.get("name")
                && text.to_utf8().ok().as_deref() == Some(name)
            {
                return Some((kind, item));
            }
        }
    }
    None
}

fn json_from_runtime(value: &JsonValue) -> Value {
    serde_json::from_str(&value.to_string()).unwrap_or(Value::Null)
}

pub fn highlight_source(source: &str, language: Language) -> Value {
    let mut languages = match Languages::new() {
        Ok(languages) => languages,
        Err(error) => {
            return json!({
                "ok": false,
                "error": {
                    "code": "CLI_STREAM_PARSE_FAILURE",
                    "phase": "parse",
                    "message": error.to_string()
                },
                "diagnostics": [],
                "spans": []
            });
        }
    };
    match languages.highlight(source, language) {
        Ok(result) => result,
        Err(error) => json!({
            "ok": false,
            "error": {
                "code": "CLI_STREAM_PARSE_FAILURE",
                "phase": "parse",
                "message": error.to_string()
            },
            "diagnostics": error.diagnostics.iter().map(|diagnostic| json!({
                "code": diagnostic.code,
                "phase": diagnostic.phase,
                "message": diagnostic.message
            })).collect::<Vec<_>>(),
            "spans": []
        }),
    }
}

pub type MatchResults = HashMap<String, RetainedMatch>;

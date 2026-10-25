use super::*;
use serde_json::json;

fn string(value: &str) -> Json {
    json!({"kind":"string","token":value})
}
fn number(value: &str) -> Json {
    json!({"kind":"number","token":value})
}
fn array(values: Vec<Json>) -> Json {
    json!({"kind":"array","items":values})
}
fn tag(name: &str, value: Json) -> Json {
    json!({"kind":"tag","tag":name,"value":value})
}
fn object(entries: Vec<(&str, Json)>) -> Json {
    json!({"kind":"object","entries":entries.into_iter().map(|(key,value)|json!({"key":key,"value":value})).collect::<Vec<_>>()})
}
fn document(ast: Json) -> DataDocument {
    DataDocument::from_ast(ast, DataLimits::default()).unwrap()
}

#[test]
// req:data-codec-003
fn encoder_rejects_shared_or_cyclic_composites_and_limits() {
    let alias = DataDocument {
        nodes: vec![DataNode::Array(vec![]), DataNode::Array(vec![0, 0])],
        root: 1,
    };
    assert!(
        alias
            .encode(false, DataLimits::default())
            .unwrap_err()
            .0
            .contains("shared")
    );
    let cycle = DataDocument {
        nodes: vec![DataNode::Array(vec![0])],
        root: 0,
    };
    assert!(cycle.encode(false, DataLimits::default()).is_err());
    let doc = document(array(vec![string("\"too long\"")]));
    assert!(
        doc.encode(
            false,
            DataLimits {
                max_bytes: 2,
                max_depth: 1
            }
        )
        .is_err()
    );
    assert!(
        doc.encode(
            false,
            DataLimits {
                max_bytes: 0,
                max_depth: 1
            }
        )
        .is_err()
    );
}

#[test]
// req:data-codec-003
fn flat_document_handles_deep_traversal_and_destruction_without_recursion() {
    let mut nodes = vec![DataNode::Null];
    for index in 0..10_000 {
        nodes.push(DataNode::Array(vec![index]));
    }
    let doc = DataDocument {
        root: nodes.len() - 1,
        nodes,
    };
    let limits = DataLimits {
        max_bytes: 30_000,
        max_depth: 10_001,
    };
    let output = doc.encode(false, limits).unwrap();
    assert_eq!(output.len(), 20_004);
    assert!(doc.encode(false, DataLimits::default()).is_err());
    drop(doc);
}

#[test]
// req:data-codec-003
fn output_and_construction_enforce_exact_byte_boundaries() {
    let ast = array(vec![json!({"kind":"null"}); 100]);
    let doc = document(ast.clone());
    let length = doc.encode(false, DataLimits::default()).unwrap().len();
    for limit in [1, length - 1, length] {
        let limits = DataLimits {
            max_bytes: limit,
            max_depth: 10,
        };
        assert_eq!(doc.encode(false, limits).is_ok(), limit == length);
        assert_eq!(
            DataDocument::from_ast(ast.clone(), limits).is_ok(),
            limit == length
        );
    }
    let mut bounded = BoundedOutput {
        text: String::new(),
        limit: 3,
        exceeded: false,
    };
    bounded.push_str("ab");
    bounded.push_str("cd");
    bounded.push_str("x");
    assert!(bounded.exceeded);
    assert_eq!(bounded.text, "ab");
}

#[test]
// req:data-codec-003
fn nesting_limits_count_physical_containers_not_tag_names() {
    let limits = DataLimits {
        max_bytes: 1000,
        max_depth: 1,
    };
    for ast in [
        tag("date", string("\"2026-10-10T00:00:00Z\"")),
        tag("set", array(vec![number("1")])),
        tag("map", array(vec![])),
        tag(
            "error",
            object(vec![
                ("name", string("\"Error\"")),
                ("message", string("\"x\"")),
            ]),
        ),
    ] {
        assert!(DataDocument::from_ast(ast, limits).is_ok());
    }
    for ast in [
        array(vec![array(vec![])]),
        tag("map", array(vec![array(vec![number("1"), number("2")])])),
    ] {
        assert!(DataDocument::from_ast(ast, limits).is_err());
    }
    let alias = DataDocument {
        nodes: vec![DataNode::Bytes(vec![]), DataNode::Array(vec![0, 0])],
        root: 1,
    };
    assert!(alias.encode(false, DataLimits::default()).is_err());
}

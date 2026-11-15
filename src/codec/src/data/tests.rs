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
// req:data-codec-007
fn replacing_a_root_field_preserves_native_subtrees_and_insertion_order() {
    let original = crate::from_str(r#"{first:undefined target:{keep:42n} last:true}"#).unwrap();
    let replacement = crate::from_str(r#"{native:@bytes"AA"}"#).unwrap();
    let updated = original
        .replace_root_field("target", &replacement, DataLimits::default())
        .unwrap();
    let encoded = updated.encode(false, DataLimits::default()).unwrap();
    assert_eq!(
        encoded,
        r#"{first:undefined target:{native:b"AA"} last:true}"#
    );
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
        object(vec![("key", number("1"))]),
        tag(
            "error",
            object(vec![
                ("name", string("\"Error\"")),
                ("message", string("\"x\"")),
            ]),
        ),
    ] {
        assert!(DataDocument::from_ast(ast.clone(), limits).is_ok(), "{ast}");
    }
    for ast in [
        array(vec![array(vec![])]),
        object(vec![("key", object(vec![("nested", number("2"))]))]),
    ] {
        assert!(DataDocument::from_ast(ast, limits).is_err());
    }

    let alias = DataDocument {
        nodes: vec![DataNode::Bytes(vec![]), DataNode::Array(vec![0, 0])],
        root: 1,
    };
    assert!(alias.encode(false, DataLimits::default()).is_err());
}

#[test]
// req:data-codec-007
fn object_keys_are_native_values_and_duplicate_keys_use_same_value_zero() {
    let document = crate::from_str(r#"{42:"answer" @symbol"registered":true}"#).unwrap();
    assert_eq!(
        document.encode(false, DataLimits::default()).unwrap(),
        r#"{42:"answer" s"registered":true}"#
    );
    for source in [
        "{1:\"a\" 1.0:\"b\"}",
        "{0:\"a\" -0:\"b\"}",
        "{NaN:\"a\" NaN:\"b\"}",
    ] {
        assert!(
            crate::from_str(source)
                .unwrap_err()
                .to_string()
                .contains("duplicate object key"),
            "{source}"
        );
    }
    assert!(crate::from_str("{[]:1 []:2}").is_ok());
    assert!(crate::from_str("@map[[1 2]]").is_err());
}

#[test]
// req:data-codec-002 req:data-codec-003
fn compact_encoding_prefers_short_tags_and_keeps_set_long() {
    for (long, short) in [
        (r#"@bytes"AA""#, r#"b"AA""#),
        (r#"@symbol"key""#, r#"s"key""#),
        (
            r#"@date"2026-10-10T00:00:00Z""#,
            r#"d"2026-10-10T00:00:00Z""#,
        ),
        (
            r#"@error{name:"Error" message:"bad"}"#,
            r#"e{name:"Error" message:"bad"}"#,
        ),
    ] {
        let encoded = crate::from_str(long)
            .unwrap()
            .encode(false, DataLimits::default())
            .unwrap();
        assert_eq!(encoded, short, "{long}");
        assert!(encoded.len() < long.len(), "{long}");
        assert_eq!(
            crate::from_str(short)
                .unwrap()
                .encode(false, DataLimits::default())
                .unwrap(),
            encoded
        );
    }
    assert_eq!(
        crate::from_str("@set[1 2]")
            .unwrap()
            .encode(false, DataLimits::default())
            .unwrap(),
        "@set[1 2]"
    );
    for source in ["s[1]", "x\"no\"", "b \"AA\"", "@unknown\"x\"", "@meta{a:1}"] {
        assert!(crate::from_str(source).is_err(), "{source}");
    }
    assert!(crate::from_str(r#"@set[@symbol"a" s"a"]"#).is_err());
}

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
// req:data-codec-003 req:runtime-strings-001
fn owned_native_scalars_encode_losslessly_without_hooks() {
    for (ast, expected) in [
        (json!({"kind":"null"}), "null"),
        (json!({"kind":"undefined"}), "undefined"),
        (json!({"kind":"boolean","value":true}), "true"),
        (number("-0"), "-0"),
        (number("NaN"), "NaN"),
        (number("Infinity"), "Infinity"),
        (number("-Infinity"), "-Infinity"),
        (number("1.25e-3"), "0.00125"),
        (
            json!({"kind":"bigint","token":"123456789012345678901234567890n"}),
            "123456789012345678901234567890n",
        ),
        (string(r#""\ud800""#), r#""\ud800""#),
        (tag("bytes", string("\"SGVsbG8\"")), "@bytes\"SGVsbG8\""),
        (tag("symbol", string(r#""\udfff""#)), r#"@symbol"\udfff""#),
        (
            tag("date", string("\"2026-10-10T00:00:00Z\"")),
            "@date\"2026-10-10T00:00:00Z\"",
        ),
    ] {
        assert_eq!(
            document(ast).encode(false, DataLimits::default()).unwrap(),
            expected
        );
    }
}

#[test]
// req:data-codec-003
fn compact_and_pretty_containers_preserve_insertion_order() {
    let doc = document(object(vec![
        ("name", string("\"Ada\"")),
        ("\"display name\"", string("\"Lovelace\"")),
        ("items", array(vec![number("1"), number("2")])),
    ]));
    assert_eq!(
        doc.encode(false, DataLimits::default()).unwrap(),
        "{\"name\":\"Ada\" \"display name\":\"Lovelace\" \"items\":[1 2]}"
    );
    assert_eq!(
        doc.encode(true, DataLimits::default()).unwrap(),
        "{\n  \"name\":\"Ada\"\n  \"display name\":\"Lovelace\"\n  \"items\":[\n    1\n    2\n  ]\n}"
    );
    let native = document(array(vec![
        tag("set", array(vec![number("1"), number("2")])),
        tag(
            "map",
            array(vec![array(vec![string("\"key\""), number("42")])]),
        ),
        tag(
            "error",
            object(vec![
                ("name", string("\"Error\"")),
                ("message", string("\"failed\"")),
                ("cause", json!({"kind":"undefined"})),
            ]),
        ),
    ]));
    assert_eq!(
        native.encode(false, DataLimits::default()).unwrap(),
        "[@set[1 2] @map[[\"key\" 42]] @error{name:\"Error\" message:\"failed\" cause:undefined}]"
    );
}

#[test]
// req:data-codec-003
fn invalid_native_payloads_and_duplicate_keys_fail_explicitly() {
    for ast in [
        number("1e999"),
        number("01"),
        json!({"kind":"bigint","token":"01n"}),
        tag("bytes", string("\"SGVsbG8=\"")),
        tag("bytes", string("\"AB\"")),
        tag("date", string("\"2026-02-30T00:00:00Z\"")),
        tag("date", string("\"2026-10-10T00:00:00.000001Z\"")),
        tag("date", number("1")),
        tag("unknown", string("\"value\"")),
        tag("error", object(vec![("name", string("\"Error\""))])),
        tag(
            "error",
            object(vec![
                ("name", string("\"Error\"")),
                ("message", string("\"x\"")),
                ("extra", number("1")),
            ]),
        ),
        object(vec![("name", number("1")), ("\"name\"", number("2"))]),
        tag("set", array(vec![number("0"), number("-0")])),
        tag("set", array(vec![number("NaN"), number("NaN")])),
        tag("map", array(vec![array(vec![number("1")])])),
        tag(
            "map",
            array(vec![
                array(vec![number("1"), number("2")]),
                array(vec![number("1"), number("3")]),
            ]),
        ),
    ] {
        assert!(DataDocument::from_ast(ast, DataLimits::default()).is_err());
    }
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
fn incoming_ast_cleanup_is_stack_safe_on_success_and_every_failure_path() {
    for (leaf, limits, success) in [
        (
            json!({"kind":"null"}),
            DataLimits {
                max_bytes: 30_000,
                max_depth: 10_001,
            },
            true,
        ),
        (
            json!({"kind":"unknown"}),
            DataLimits {
                max_bytes: 30_000,
                max_depth: 10_001,
            },
            false,
        ),
        (json!({"kind":"null"}), DataLimits::default(), false),
        (
            json!({"kind":"null"}),
            DataLimits {
                max_bytes: 0,
                max_depth: 1,
            },
            false,
        ),
    ] {
        let mut ast = leaf;
        for _ in 0..10_000 {
            ast = Json::Object(serde_json::Map::from_iter([
                ("kind".to_owned(), Json::String("array".to_owned())),
                ("items".to_owned(), Json::Array(vec![ast])),
            ]));
        }
        assert_eq!(DataDocument::from_ast(ast, limits).is_ok(), success);
    }
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

#[test]
// req:data-codec-003 req:runtime-strings-001
fn codec_roundtrips_every_utf16_unit_and_lossless_property_keys() {
    for unit in 0..=u16::MAX {
        let value = RuntimeString::from_utf16(vec![unit]);
        let mut token = String::new();
        value.write_json_string(&mut token).unwrap();
        let doc = document(string(&token));
        let DataNode::String(actual) = &doc.nodes()[doc.root()] else {
            panic!("string node expected");
        };
        assert_eq!(actual, &value);
        assert_eq!(doc.encode(false, DataLimits::default()).unwrap(), token);
    }
    let doc = document(object(vec![
        (r#""\ud800""#, string(r#""\udfff""#)),
        ("__proto__", json!({"kind":"null"})),
    ]));
    assert_eq!(
        doc.encode(false, DataLimits::default()).unwrap(),
        r#"{"\ud800":"\udfff" "__proto__":null}"#
    );
    let distinct = document(tag("set", array(vec![array(vec![]), array(vec![])])));
    assert_eq!(
        distinct.encode(false, DataLimits::default()).unwrap(),
        "@set[[] []]"
    );
    let duplicate = tag(
        "set",
        array(vec![
            tag("symbol", string(r#""x""#)),
            tag("symbol", string(r#""\u0078""#)),
        ]),
    );
    assert!(DataDocument::from_ast(duplicate, DataLimits::default()).is_err());
}

#[test]
// req:data-codec-002 req:data-codec-003
fn authored_grammar_roundtrips_native_records_with_demand_driven_streaming() {
    let sources = [
        r#"{name:"Ada" "space key":[undefined null -0 NaN Infinity -Infinity 12345678901234567890n "\ud800"]}"#,
        r#"[@date"2026-10-10T00:00:00.123Z" @bytes"SGVsbG8" @symbol"registry" @set[1 2] @map[["key" true]] @error{name:"Error" message:"failed" stack:"trace" cause:undefined}]"#,
    ];
    let stream = sources.join("\n") + "\n";
    let mut decoder = DataDecoder::new(DataLimits::default()).unwrap();
    let (consumed, first) = decoder.push_some(stream.as_bytes()).unwrap();
    assert_eq!(consumed, sources[0].len() + 1);
    let first = first.unwrap();
    assert_eq!((first.span.start, first.span.end), (0, sources[0].len()));
    let (_, second) = decoder.push_some(&stream.as_bytes()[consumed..]).unwrap();
    let second = second.unwrap();
    assert!(decoder.finish().unwrap().is_none());
    for doc in [first.document, second.document] {
        let canonical = doc.encode(false, DataLimits::default()).unwrap();
        for pretty in [false, true] {
            let encoded = doc.encode(pretty, DataLimits::default()).unwrap();
            decoder.reset();
            for byte in encoded.as_bytes() {
                assert!(decoder.push_some(&[*byte]).unwrap().1.is_none());
            }
            let parsed = decoder.finish().unwrap().unwrap().document;
            assert_eq!(
                parsed.encode(false, DataLimits::default()).unwrap(),
                canonical
            );
        }
    }
    decoder.reset();
    let error = decoder.push_some(b"@unknown\"x\"\nnull\n").unwrap_err();
    assert!(error.0.contains("record at byte 0"));
    assert_eq!(decoder.push_some(b"null\n").unwrap_err(), error);
    decoder.reset();
    decoder.cancel().unwrap();
    assert!(decoder.push_some(b"null\n").is_err());
}

#[test]
// req:data-codec-001 req:data-codec-002 req:data-codec-003
fn value_decoding_is_invariant_under_every_two_chunk_split() {
    let source = "# leading\n\"😀\\udfff\" # comment\n@set[1\n2]\n{a:true}";
    let expected = [r#""😀\udfff""#, "@set[1 2]", "{\"a\":true}"];
    let mut decoder = DataDecoder::new(DataLimits::default()).unwrap();
    for split in 0..=source.len() {
        decoder.reset();
        let mut actual = Vec::new();
        for mut chunk in [&source.as_bytes()[..split], &source.as_bytes()[split..]] {
            while !chunk.is_empty() {
                let (consumed, record) = decoder.push_some(chunk).unwrap();
                assert!(consumed > 0 && consumed <= chunk.len());
                chunk = &chunk[consumed..];
                if let Some(record) = record {
                    actual.push(
                        record
                            .document
                            .encode(false, DataLimits::default())
                            .unwrap(),
                    );
                }
            }
        }
        if let Some(record) = decoder.finish().unwrap() {
            actual.push(
                record
                    .document
                    .encode(false, DataLimits::default())
                    .unwrap(),
            );
        }
        assert_eq!(actual, expected);
    }
    decoder.reset();
    let error = decoder.push_some(b"@bytes\"AB\"\nnull\n").unwrap_err();
    assert!(error.0.contains("record at byte 0"));
    assert_eq!(decoder.finish().unwrap_err(), error);
    decoder.reset();
    assert_eq!(
        decoder
            .push_some(b"null\n")
            .unwrap()
            .1
            .unwrap()
            .document
            .encode(false, DataLimits::default())
            .unwrap(),
        "null"
    );
    assert!(decoder.finish().unwrap().is_none());
    assert!(decoder.finish().is_err());
}

#[test]
// req:data-codec-003
fn authored_decoding_accepts_the_exact_configured_nesting_boundary() {
    let limits = DataLimits {
        max_bytes: 10_000,
        max_depth: DataLimits::default().max_depth,
    };
    let mut decoder = DataDecoder::new(limits).unwrap();
    let source = "[".repeat(limits.max_depth) + "null" + &"]".repeat(limits.max_depth);
    assert!(decoder.push_some(source.as_bytes()).unwrap().1.is_none());
    let doc = decoder.finish().unwrap().unwrap().document;
    assert_eq!(doc.encode(false, limits).unwrap(), source);
    decoder.reset();
    let too_deep = "[".repeat(limits.max_depth + 1);
    assert!(
        decoder
            .push_some(too_deep.as_bytes())
            .unwrap_err()
            .0
            .contains("nesting")
    );
}

#[test]
// req:data-codec-003
fn value_decoder_enforces_source_size_before_ast_construction() {
    let limits = DataLimits {
        max_bytes: 4,
        max_depth: 2,
    };
    let mut decoder = DataDecoder::new(limits).unwrap();
    assert!(decoder.push_some(b"null\n").unwrap().1.is_some());
    let error = decoder.push_some(b"false\ntrue\n").unwrap_err();
    assert!(error.0.contains("4-byte limit"));
    assert_eq!(decoder.push_some(b"true\n").unwrap_err(), error);
    decoder.reset();
    assert!(decoder.push_some(b"true\n").unwrap().1.is_some());
    assert!(
        DataDecoder::new(DataLimits {
            max_bytes: 0,
            max_depth: 1
        })
        .is_err()
    );
    assert!(
        DataDecoder::new(DataLimits {
            max_bytes: 1,
            max_depth: 0
        })
        .is_err()
    );
}

#[test]
// req:data-codec-001 req:data-codec-002 req:data-codec-003
fn value_decoder_handles_empty_stream_trivia_comments_and_unterminated_final_line() {
    let mut decoder = DataDecoder::new(DataLimits::default()).unwrap();
    assert!(decoder.finish().unwrap().is_none());
    assert!(decoder.finish().is_err());
    decoder.reset();
    let source = b"# lead\n \t\nnull # final comment";
    assert!(decoder.push_some(source).unwrap().1.is_none());
    let record = decoder.finish().unwrap().unwrap();
    assert_eq!(
        record
            .document
            .encode(false, DataLimits::default())
            .unwrap(),
        "null"
    );
    assert_eq!(record.span.start, 10);
    assert_eq!(record.span.end, source.len());
    assert!(decoder.finish().is_err());
}

#[test]
// req:data-codec-003 req:runtime-memory-001 req:runtime-core-012
fn native_documents_materialize_and_export_gc_values_without_identity_loss() {
    use crate::value::Value;
    uffda_heap::rootless_mutate(|mc| {
        let date = time::OffsetDateTime::parse(
            "2026-10-10T18:00:00.123-05:00",
            &time::format_description::well_known::Rfc3339,
        )
        .unwrap();
        let bigint =
            num_bigint::BigInt::parse_bytes(b"123456789012345678901234567890", 10).unwrap();
        let doc = document(array(vec![
            json!({"kind":"bigint","token":"123456789012345678901234567890n"}),
            tag("date", string("\"2026-10-10T18:00:00.123-05:00\"")),
            tag("symbol", string("\"registry-key\"")),
            tag("bytes", string("\"AQID\"")),
            tag("set", array(vec![number("1"), string("\"two\"")])),
            tag(
                "map",
                array(vec![array(vec![
                    string("\"k\""),
                    json!({"kind":"boolean","value":true}),
                ])]),
            ),
            tag(
                "error",
                object(vec![
                    ("name", string("\"TypeError\"")),
                    ("message", string("\"invalid\"")),
                    ("stack", string("\"frame\"")),
                    ("cause", json!({"kind":"null"})),
                ]),
            ),
        ]));
        let runtime = doc.materialize(mc);
        let exported = DataDocument::from_value(runtime, DataLimits::default()).unwrap();
        assert_eq!(
            exported.encode(false, DataLimits::default()).unwrap(),
            doc.encode(false, DataLimits::default()).unwrap()
        );
        let Value::Array(items) = runtime.raw() else {
            panic!("expected array")
        };
        let items = items.borrow();
        let Value::BigInt(actual_bigint) = items[0].raw() else {
            panic!("expected BigInt")
        };
        assert_eq!(actual_bigint.0, bigint);
        let Value::Date(actual_date) = items[1].raw() else {
            panic!("expected Date")
        };
        assert_eq!(actual_date.0, date);
        assert_eq!(items[2].runtime_type(), crate::value::RuntimeType::Symbol);
        assert_eq!(items[4].runtime_type(), crate::value::RuntimeType::Set);
        assert_eq!(items[5].runtime_type(), crate::value::RuntimeType::Map);
        let Value::Error(actual_error) = items[6].raw() else {
            panic!("expected Error")
        };
        assert_eq!(actual_error.name, RuntimeString::from("TypeError"));
        assert_eq!(actual_error.message, RuntimeString::from("invalid"));
        assert_eq!(actual_error.stack, Some(RuntimeString::from("frame")));
        assert!(
            actual_error
                .cause
                .is_some_and(|value| value.strict_eq(Value::Null))
        );
    });
}

#[test]
// req:data-codec-003
fn runtime_export_rejects_aliases_cycles_symbols_as_keys_and_execution_values() {
    use crate::value::Value;
    uffda_heap::rootless_mutate(|mc| {
        let shared = Value::array(mc, vec![]);
        let alias = Value::array(mc, vec![shared, shared]);
        assert!(
            DataDocument::from_value(alias, DataLimits::default())
                .unwrap_err()
                .0
                .contains("shared")
        );
        let cycle = Value::array(mc, vec![]);
        let Value::Array(items) = cycle else {
            panic!("expected array")
        };
        items.borrow_mut(mc).push(cycle);
        assert!(DataDocument::from_value(cycle, DataLimits::default()).is_err());
        let symbol_keyed = Value::object(mc, vec![]);
        let Value::Object(properties) = symbol_keyed else {
            panic!("expected object")
        };
        properties
            .borrow_mut(mc)
            .set_symbol("key".into(), Value::Null);
        assert!(
            DataDocument::from_value(symbol_keyed, DataLimits::default())
                .unwrap_err()
                .0
                .contains("symbol object keys")
        );
        assert!(
            DataDocument::from_value(
                Value::Native(crate::globals::NativeGlobal::Id),
                DataLimits::default()
            )
            .is_err()
        );
        let overflowing = Value::bigint(mc, num_bigint::BigInt::from(12_345));
        assert!(
            DataDocument::from_value(
                overflowing,
                DataLimits {
                    max_bytes: 4,
                    max_depth: 1
                }
            )
            .is_err()
        );
        let mut deep = Value::Null;
        for _ in 0..10_000 {
            deep = Value::array(mc, vec![deep]);
        }
        let exported = DataDocument::from_value(
            deep,
            DataLimits {
                max_bytes: 30_000,
                max_depth: 10_001,
            },
        )
        .unwrap();
        assert_eq!(
            exported.encode(false, DataLimits::default()).unwrap_err().0,
            "data nesting limit exceeded"
        );
        let submillisecond = Value::date(
            mc,
            time::OffsetDateTime::UNIX_EPOCH
                .replace_nanosecond(1)
                .unwrap(),
        );
        assert!(DataDocument::from_value(submillisecond, DataLimits::default()).is_err());
    });
}

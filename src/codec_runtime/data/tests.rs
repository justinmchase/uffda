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
#[cfg(feature = "embed-languages")]
// req:data-codec-005 req:data-codec-002 req:data-codec-003 req:data-codec-008
fn native_parser_matches_authored_grammar_and_fixed_construction() {
    let mut languages = crate::languages::Languages::new().unwrap();
    let limits = DataLimits::default();
    let valid = [
        "null",
        "undefined",
        "true",
        "false",
        "-0",
        "NaN",
        "Infinity",
        "-Infinity",
        "1.25e-3",
        "-123456789012345678901234567890n",
        r#""😀\ud800\u0000\n\"\\""#,
        "[1 2# separator\n3]",
        r#"{"\udfff":"\ud800" __proto__:null}"#,
        r#"[@date "2026-10-10T00:00:00.123Z" @bytes "SGVsbG8" @symbol "\udfff"]"#,
        r#"[@set[1 2] {"key":true @symbol"x":undefined} @error{name:"Error" message:"failed" stack:"trace" cause:[null]}]"#,
        r#"[[] {} "" @set[] {}]"#,
    ];
    let invalid = [
        "",
        "null true",
        "[1,2]",
        r#"["a""b"]"#,
        "{a:1,b:2}",
        "{a:1 a:2}",
        r#"{"a":1 "\u0061":2}"#,
        "01",
        "1.",
        "1e",
        "+1",
        "1e999",
        "01n",
        r#""\q""#,
        r#""\u123""#,
        "\"control\u{1}\"",
        "[",
        "{a}",
        "{a:}",
        "[1",
        "@unknown\"x\"",
        "@meta{}",
        "@date[1]",
        "@set @set[]",
        "@bytes\"AB\"",
        "@date\"2026-10-10T00:00:00.0001Z\"",
        "@set[0 -0]",
        "{1:2 1:3}",
        "{1}",
        "@error{name:\"Error\"}",
        "@error{name:1 message:\"x\"}",
        "@error{name:\"Error\" message:\"x\" extra:0}",
        "(add 1 2)",
        "import \"x\"",
    ];
    for (sources, accepted) in [(&valid[..], true), (&invalid[..], false)] {
        for source in sources {
            let native = uffda_codec::from_str(source).and_then(|doc| doc.encode(false, limits));
            let authored = languages
                .parse_data(source)
                .map_err(|cause| error(cause.to_string()))
                .and_then(|ast| DataDocument::from_ast(ast, limits))
                .and_then(|doc| doc.encode(false, limits));
            assert_eq!(native.is_ok(), accepted, "native: {source:?}: {native:?}");
            assert_eq!(
                authored.is_ok(),
                accepted,
                "authored: {source:?}: {authored:?}"
            );
            if accepted {
                assert_eq!(native.unwrap(), authored.unwrap(), "{source:?}");
            }
        }
    }
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
        "{name:\"Ada\" \"display name\":\"Lovelace\" items:[1 2]}"
    );
    assert_eq!(
        doc.encode(true, DataLimits::default()).unwrap(),
        "{\n  name:\"Ada\"\n  \"display name\":\"Lovelace\"\n  items:[\n    1\n    2\n  ]\n}"
    );
    let native = document(array(vec![
        tag("set", array(vec![number("1"), number("2")])),
        object(vec![("key", number("42"))]),
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
        "[@set[1 2] {key:42} @error{name:\"Error\" message:\"failed\" cause:undefined}]"
    );
}

#[test]
// req:data-codec-003 req:data-codec-008
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
        object(vec![("name", number("1")), ("name", number("2"))]),
        tag("map", array(vec![])),
    ] {
        assert!(
            DataDocument::from_ast(ast.clone(), DataLimits::default()).is_err(),
            "{ast}"
        );
    }
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
        r#"{"\ud800":"\udfff" __proto__:null}"#
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
        r#"[@date"2026-10-10T00:00:00.123Z" @bytes"SGVsbG8" @symbol"registry" @set[1 2] {key:true} @error{name:"Error" message:"failed" stack:"trace" cause:undefined}]"#,
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
    let expected = [r#""😀\udfff""#, "@set[1 2]", "{a:true}"];
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
            object(vec![("k", json!({"kind":"boolean","value":true}))]),
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
        assert_eq!(items[5].runtime_type(), crate::value::RuntimeType::Object);
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
fn runtime_export_rejects_aliases_cycles_and_execution_values_but_encodes_native_keys() {
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
        let encoded = DataDocument::from_value(symbol_keyed, DataLimits::default())
            .unwrap()
            .encode(false, DataLimits::default())
            .unwrap();
        assert_eq!(encoded, r#"{@symbol"key":null}"#);
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

#[derive(Clone, Debug, PartialEq)]
struct CorpusRecord {
    codec: String,
    json: Json,
}

#[derive(Clone, Debug, PartialEq)]
struct CorpusWorkload {
    name: String,
    records: Vec<CorpusRecord>,
}

fn tagged_json(type_name: &str, value: Option<Json>) -> Json {
    match value {
        Some(value) => json!({ "$type": type_name, "value": value }),
        None => json!({ "$type": type_name }),
    }
}

fn codec_corpus(count: usize) -> Vec<CorpusWorkload> {
    assert!(count > 0, "Record count must be a positive safe integer");
    let mut ordinary = Vec::new();
    let mut text = Vec::new();
    let mut nested = Vec::new();
    let mut native = Vec::new();
    for i in 0..count {
        let value = json!({
            "id": i,
            "sensor": format!("sensor-{}", i % 7),
            "ok": i % 3 != 0,
            "readings": [i as f64, i as f64 + 0.25, -(i as f64) - 1.0],
            "note": null
        });
        ordinary.push(CorpusRecord {
            codec: format!(
                "{{id:{i} sensor:\"sensor-{}\" ok:{} readings:[{i} {} {}] note:null}}",
                i % 7,
                i % 3 != 0,
                i as f64 + 0.25,
                -(i as f64) - 1.0
            ),
            json: value,
        });
        let message = format!(
            "record {i}: café 日本語 😀 \"quoted\" \\ slash\nline\t{}",
            "#".repeat(12)
        );
        text.push(CorpusRecord {
            codec: serde_json::to_string(&message).unwrap(),
            json: json!(message),
        });
        let tree = json!({
            "id": i,
            "items": [
                {"name": "first", "values": [1, 2, 3]},
                {"name": "second", "values": [4, 5, 6]}
            ],
            "meta": {"region": "west", "tags": ["a", "b"], "optional": null}
        });
        nested.push(CorpusRecord {
            codec: format!(
                "{{id:{i} items:[{{name:\"first\" values:[1 2 3]}} {{name:\"second\" values:[4 5 6]}}] meta:{{region:\"west\" tags:[\"a\" \"b\"] optional:null}}}}"
            ),
            json: tree,
        });
        let bigint = format!("12345678901234567890{i}");
        native.push(CorpusRecord {
            codec: format!(
                "{{id:{i} missing:undefined big:{bigint}n date:@date\"2026-10-12T00:00:00Z\" bytes:@bytes\"AAECA_8\" symbol:@symbol\"sample\" set:@set[1 \"x\"] assoc:{{key:42}} error:@error{{name:\"TypeError\" message:\"sample\" cause:{i}}} special:[NaN Infinity -Infinity -0]}}"
            ),
            json: json!({
                "id": i,
                "missing": tagged_json("undefined", None),
                "big": tagged_json("bigint", Some(json!(bigint))),
                "date": tagged_json("date", Some(json!("2026-10-12T00:00:00Z"))),
                "bytes": tagged_json("bytes", Some(json!("AAECA_8"))),
                "symbol": tagged_json("symbol", Some(json!("sample"))),
                "set": tagged_json("set", Some(json!([1, "x"]))),
                "assoc": json!({"key": 42}),
                "error": tagged_json("error", Some(json!({
                    "name": "TypeError",
                    "message": "sample",
                    "cause": i
                }))),
                "special": [
                    tagged_json("number", Some(json!("NaN"))),
                    tagged_json("number", Some(json!("Infinity"))),
                    tagged_json("number", Some(json!("-Infinity"))),
                    tagged_json("number", Some(json!("-0"))),
                ]
            }),
        });
    }
    vec![
        CorpusWorkload {
            name: "ordinary".into(),
            records: ordinary,
        },
        CorpusWorkload {
            name: "unicode-text".into(),
            records: text,
        },
        CorpusWorkload {
            name: "nested".into(),
            records: nested,
        },
        CorpusWorkload {
            name: "native-tagged".into(),
            records: native,
        },
    ]
}

fn corpus_transport(workload: &CorpusWorkload, format: &str) -> String {
    match format {
        "codec" => workload
            .records
            .iter()
            .map(|record| format!("{}\n", record.codec))
            .collect(),
        "jsonl" => workload
            .records
            .iter()
            .map(|record| format!("{}\n", serde_json::to_string(&record.json).unwrap()))
            .collect(),
        "json" => serde_json::to_string(
            &workload
                .records
                .iter()
                .map(|record| &record.json)
                .collect::<Vec<_>>(),
        )
        .unwrap(),
        _ => panic!("Unknown transport: {format}"),
    }
}

fn median(values: &[f64]) -> f64 {
    assert!(
        !values.is_empty()
            && values
                .iter()
                .all(|value| value.is_finite() && *value >= 0.0),
        "Median requires nonnegative finite samples"
    );
    let mut sorted = values.to_vec();
    sorted.sort_by(|left, right| left.partial_cmp(right).unwrap());
    let middle = sorted.len() / 2;
    if sorted.len().is_multiple_of(2) {
        (sorted[middle - 1] + sorted[middle]) / 2.0
    } else {
        sorted[middle]
    }
}

#[test]
// req:data-codec-004
fn remport_representative_corpus_is_deterministic_and_json_comparisons_retain_native_tags() {
    let corpus = codec_corpus(2);
    assert_eq!(codec_corpus(2), corpus);
    assert_eq!(
        corpus
            .iter()
            .map(|workload| workload.name.as_str())
            .collect::<Vec<_>>(),
        ["ordinary", "unicode-text", "nested", "native-tagged"]
    );
    for workload in &corpus {
        assert_eq!(
            serde_json::from_str::<Json>(&corpus_transport(workload, "json")).unwrap(),
            Json::Array(
                workload
                    .records
                    .iter()
                    .map(|record| record.json.clone())
                    .collect()
            )
        );
        let lines: Vec<Json> = corpus_transport(workload, "jsonl")
            .trim()
            .split('\n')
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(
            lines,
            workload
                .records
                .iter()
                .map(|record| record.json.clone())
                .collect::<Vec<_>>()
        );
        assert_eq!(corpus_transport(workload, "codec").split('\n').count(), 3);
    }
    assert_eq!(
        corpus[3].records[0].json,
        codec_corpus(1)[3].records[0].json
    );
    assert!(std::panic::catch_unwind(|| codec_corpus(0)).is_err());
    assert!(std::panic::catch_unwind(|| corpus_transport(&corpus[0], "unknown")).is_err());
}

#[test]
// req:data-codec-004
fn remport_measurements_summarize_independent_samples_without_accepting_invalid_timing() {
    assert_eq!(median(&[9.0, 2.0, 4.0]), 4.0);
    assert_eq!(median(&[9.0, 2.0, 4.0, 3.0]), 3.5);
    assert_eq!(median(&[0.0]), 0.0);
    for values in [&[][..], &[f64::NAN][..], &[-1.0][..], &[f64::INFINITY][..]] {
        assert!(std::panic::catch_unwind(|| median(values)).is_err());
    }
}

#[test]
// req:data-codec-004
fn remport_persistent_baseline_contains_every_transport_pipeline_and_long_samples() {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SizeRow {
        workload: String,
        format: String,
        raw_bytes: u64,
        gzip_bytes: u64,
    }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SampleRow {
        workload: String,
        format: String,
        compression: String,
        operation: String,
        peak_rss_ki_b: u64,
        chunk_bytes: u64,
        records: u64,
        elapsed_ms: f64,
        bytes: u64,
    }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ScalingRow {
        workload: String,
        format: String,
        compression: String,
        records: u64,
    }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Baseline {
        sizes: Vec<SizeRow>,
        samples: Vec<SampleRow>,
        memory_scaling: Vec<ScalingRow>,
    }
    let baseline: Baseline =
        serde_json::from_str(include_str!("../../../tests/perf/data-codec-baseline.json")).unwrap();
    assert_eq!(baseline.sizes.len(), 12);
    assert_eq!(baseline.samples.len(), 216);
    assert_eq!(baseline.memory_scaling.len(), 24);
    for workload in ["ordinary", "unicode-text", "nested", "native-tagged"] {
        for format in ["codec", "json", "jsonl"] {
            let sizes: Vec<_> = baseline
                .sizes
                .iter()
                .filter(|row| row.workload == workload && row.format == format)
                .collect();
            assert_eq!(sizes.len(), 1);
            assert!(sizes[0].raw_bytes > 0 && sizes[0].gzip_bytes > 0);
            for compression in ["raw", "gzip"] {
                for operation in ["encode", "decode", "baseline"] {
                    let samples: Vec<_> = baseline
                        .samples
                        .iter()
                        .filter(|row| {
                            row.workload == workload
                                && row.format == format
                                && row.compression == compression
                                && row.operation == operation
                        })
                        .collect();
                    assert_eq!(samples.len(), 3);
                    for sample in samples {
                        assert!(sample.peak_rss_ki_b > 0);
                        assert_eq!(sample.chunk_bytes, 4096);
                        if operation == "baseline" {
                            assert_eq!(sample.records, 0);
                        } else {
                            assert!(
                                sample.elapsed_ms >= 100.0
                                    && sample.bytes > 0
                                    && sample.records >= 256
                            );
                            assert_eq!(sample.records % 32, 0);
                        }
                    }
                }
                if matches!(workload, "ordinary" | "native-tagged") {
                    let scaling: Vec<_> = baseline
                        .memory_scaling
                        .iter()
                        .filter(|row| {
                            row.workload == workload
                                && row.format == format
                                && row.compression == compression
                        })
                        .map(|row| row.records)
                        .collect();
                    assert_eq!(scaling, [32, 4096]);
                }
            }
        }
    }
}

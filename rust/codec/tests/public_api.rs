use uffda_codec::data::{DataDecoder, DataDocument, DataLimits, DataNode};
use uffda_codec::{from_str, to_string};

#[test]
// req:data-codec-006
fn independent_reader_writer_preserve_fixed_native_values_and_comments() {
    let source = r#"# lead
{value:[undefined null true -0 NaN Infinity -Infinity 12345678901234567890n "\ud800"]
 native:[@date"2026-10-10T00:00:00.123Z" @bytes"SGVsbG8" @symbol"key"
 @set[1 2] @map[["x" 1]] @error{name:"Error" message:"bad" cause:null}]} # trailing
"#;
    let text = to_string(&from_str(source).unwrap()).unwrap();
    assert!(!text.contains('\n'));
    assert!(text.contains(r#""\ud800""#));
    assert_eq!(to_string(&from_str(&text).unwrap()).unwrap(), text);
    assert!(matches!(
        from_str("undefined").unwrap().nodes()[0],
        DataNode::Undefined
    ));
    assert!(from_str("# comment only\n").is_err());
    for source in [
        "1\n2",
        "1\nbad",
        "1 2",
        "[1,2]",
        "{x:1 x:2}",
        "@unknown[]",
        "(add 1 2)",
    ] {
        assert!(from_str(source).is_err(), "{source:?}");
    }
}

#[test]
// req:data-codec-006
fn errors_expose_absolute_byte_positions_across_chunks_and_records() {
    let source = "# first\nnull\n{a 1}\n";
    let expected = source.find('1').unwrap();
    for split in 0..=source.len() {
        let mut decoder = DataDecoder::new(DataLimits::default()).unwrap();
        let mut actual = None;
        for mut chunk in [&source.as_bytes()[..split], &source.as_bytes()[split..]] {
            while !chunk.is_empty() {
                match decoder.push_some(chunk) {
                    Ok((consumed, _)) => chunk = &chunk[consumed..],
                    Err(error) => {
                        actual = Some(error);
                        break;
                    }
                }
            }
            if actual.is_some() {
                break;
            }
        }
        let error = actual.unwrap();
        assert_eq!(error.offset(), Some(expected), "split {split}");
        assert!(error.to_string().contains("expected : after object key"));
        assert_eq!(decoder.finish().unwrap_err(), error);
    }
    let error = from_str("[}").unwrap_err();
    assert_eq!(error.offset(), Some(1));
}

#[test]
// req:data-codec-006
fn safe_document_construction_rejects_invalid_indices_duplicates_and_aliases() {
    let limits = DataLimits::default();
    assert!(DataDocument::from_nodes(vec![], 0, limits).is_err());
    assert!(DataDocument::from_nodes(vec![DataNode::Array(vec![0])], 0, limits).is_err());
    assert!(DataDocument::from_nodes(vec![DataNode::Array(vec![100])], 0, limits).is_err());
    assert!(
        DataDocument::from_nodes(
            vec![DataNode::Array(vec![]), DataNode::Array(vec![0, 0])],
            1,
            limits,
        )
        .is_err()
    );
    assert!(
        DataDocument::from_nodes(
            vec![
                DataNode::Null,
                DataNode::Object(vec![("x".into(), 0), ("x".into(), 0)])
            ],
            1,
            limits,
        )
        .is_err()
    );
    assert!(
        DataDocument::from_nodes(
            vec![DataNode::Number(1.0), DataNode::Set(vec![0, 0])],
            1,
            limits,
        )
        .is_err()
    );
    let document =
        DataDocument::from_nodes(vec![DataNode::Null, DataNode::Array(vec![0])], 1, limits)
            .unwrap();
    assert_eq!(to_string(&document).unwrap(), "[null]");
    let precise = time::OffsetDateTime::from_unix_timestamp_nanos(1).unwrap();
    assert!(
        DataDocument::from_nodes(vec![DataNode::Date(precise), DataNode::Null], 1, limits,)
            .is_err()
    );
}

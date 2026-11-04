//! Encode and decode ModuleDeclaration values as data-codec records.

use crate::json::JsonValue;
use crate::text::RuntimeString;
use crate::value::Value;
use uffda_heap::Mutation;

/// Encode a JSON ModuleDeclaration object as one data-codec record (with trailing newline).
pub fn encode_declaration_codec(value: &JsonValue) -> Result<String, String> {
    if !value.is_object() {
        return Err("declaration must be a ModuleDeclaration".into());
    }
    uffda_heap::rootless_mutate(|mc| {
        let heap = json_to_heap(mc, value)?;
        crate::output::codec_output(heap).map_err(|error| error.to_string())
    })
}

/// Decode one data-codec record into a JSON ModuleDeclaration object.
pub fn decode_declaration_codec(text: &str) -> Result<JsonValue, String> {
    decode_declaration_codec_as(text)
}

/// Decode a declaration schema directly from its owned codec document.
pub fn decode_declaration_codec_as<T: serde::de::DeserializeOwned>(
    text: &str,
) -> Result<T, String> {
    let document =
        crate::codec::data::DataDocument::from_codec(text).map_err(|error| error.to_string())?;
    if !matches!(
        document.nodes()[document.root()],
        crate::codec::data::DataNode::Object(_)
    ) {
        return Err("declaration must be a ModuleDeclaration".into());
    }
    uffda_codec::data::de::from_document(&document).map_err(|error| error.to_string())
}

/// Encode declaration fields directly from owned codec documents.
pub fn encode_declaration_documents(
    declaration: &crate::resolver::ModuleDeclaration,
) -> Result<String, String> {
    fn array(items: &[crate::codec::data::DataDocument]) -> Result<String, String> {
        items
            .iter()
            .map(|item| {
                item.encode(false, crate::codec::data::DataLimits::default())
                    .map_err(|error| error.to_string())
            })
            .collect::<Result<Vec<_>, _>>()
            .map(|items| format!("[{}]", items.join(" ")))
    }

    let text = format!(
        "{{imports:{} exports:{} rules:{} funcs:{} decorators:{}}}\n",
        array(&declaration.imports)?,
        array(&declaration.exports)?,
        array(&declaration.rules)?,
        array(&declaration.funcs)?,
        array(&declaration.decorators)?,
    );
    let _: crate::resolver::ModuleDeclaration = decode_declaration_codec_as(&text)?;
    Ok(text)
}

fn json_to_heap<'gc>(mc: &Mutation<'gc>, value: &JsonValue) -> Result<Value<'gc>, String> {
    enum Work<'a> {
        Visit(&'a JsonValue),
        Array(usize),
        Object(Vec<RuntimeString>),
    }
    let mut stack = vec![Work::Visit(value)];
    let mut values = Vec::new();
    while let Some(work) = stack.pop() {
        match work {
            Work::Visit(JsonValue::Null) => values.push(Value::Null),
            Work::Visit(JsonValue::Bool(value)) => values.push(Value::Boolean(*value)),
            Work::Visit(JsonValue::Number(value)) => {
                let number = value
                    .as_f64()
                    .ok_or_else(|| "invalid declaration number".to_string())?;
                values.push(Value::Number(number));
            }
            Work::Visit(JsonValue::String(value)) => {
                values.push(Value::string(mc, value.clone()));
            }
            Work::Visit(JsonValue::Array(items)) => {
                stack.push(Work::Array(items.len()));
                for item in items.iter().rev() {
                    stack.push(Work::Visit(item));
                }
            }
            Work::Visit(JsonValue::Object(map)) => {
                let entries: Vec<_> = map.iter().collect();
                let keys: Vec<_> = entries.iter().map(|(key, _)| (*key).clone()).collect();
                stack.push(Work::Object(keys));
                for (_, item) in entries.into_iter().rev() {
                    stack.push(Work::Visit(item));
                }
            }
            Work::Array(count) => {
                let start = values
                    .len()
                    .checked_sub(count)
                    .ok_or_else(|| "invalid declaration array".to_string())?;
                let children = values.split_off(start);
                values.push(Value::array(mc, children));
            }
            Work::Object(keys) => {
                let start = values
                    .len()
                    .checked_sub(keys.len())
                    .ok_or_else(|| "invalid declaration object".to_string())?;
                let children = values.split_off(start);
                values.push(Value::object(mc, keys.into_iter().zip(children).collect()));
            }
        }
    }
    values
        .pop()
        .ok_or_else(|| "declaration did not produce a value".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::json;

    #[test]
    // req:project-file-003 req:cli-bootstrap-004 req:cli-compile-002
    fn declaration_codec_roundtrips_module_declaration_shape() {
        let source = r#"{"imports":[],"exports":[{"name":"Main"}],"rules":[{"name":"Main","pattern":{"kind":"any"}}],"funcs":[],"decorators":[]}"#;
        let original: JsonValue = json::from_str(source).unwrap();
        let encoded = encode_declaration_codec(&original).unwrap();
        assert!(encoded.ends_with('\n'));
        let decoded = decode_declaration_codec(&encoded).unwrap();
        let back: crate::resolver::ModuleDeclaration = json::from_value(decoded).unwrap();
        assert!(back.imports.is_empty());
        assert_eq!(
            back.exports[0]
                .field("name")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref(),
            Some("Main")
        );
        assert_eq!(
            back.rules[0]
                .field("name")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref(),
            Some("Main")
        );
        assert_eq!(
            back.rules[0]
                .field("pattern")
                .unwrap()
                .unwrap()
                .field("kind")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref(),
            Some("any")
        );
    }

    #[test]
    // req:data-codec-007
    fn declaration_schema_decodes_without_runtime_materialization() {
        let source = r#"{imports:[] exports:[{name:"Main"}] rules:[{name:"Main" pattern:{kind:"equal" value:{kind:"value" value:"\ud800"}}}]}"#;
        let declaration: crate::resolver::ModuleDeclaration =
            decode_declaration_codec_as(source).unwrap();
        let name = declaration.rules[0]
            .field("name")
            .unwrap()
            .unwrap()
            .string_value();
        assert_eq!(name.as_deref(), Some("Main"));
        let literal = declaration.rules[0]
            .field("pattern")
            .unwrap()
            .unwrap()
            .field("value")
            .unwrap()
            .unwrap()
            .field("value")
            .unwrap()
            .unwrap();
        let crate::codec::data::DataNode::String(value) = &literal.nodes()[literal.root()] else {
            panic!("expected lossless literal");
        };
        assert_eq!(value.as_utf16(), &[0xd800]);
        assert!(declaration.funcs.is_empty());
        assert!(declaration.decorators.is_empty());
    }

    #[test]
    // req:cli-bootstrap-004
    fn declaration_codec_rejects_non_object_roots() {
        assert!(encode_declaration_codec(&JsonValue::Null).is_err());
        assert!(decode_declaration_codec("null\n").is_err());
        assert!(decode_declaration_codec("[1 2]\n").is_err());
    }

    #[test]
    // req:data-codec-005
    fn declaration_codec_rejects_trailing_records_and_invalid_input() {
        for text in ["{}\n{}\n", "{}\n{}\n{}\n", "{}\ninvalid", "{}\n["] {
            assert!(decode_declaration_codec(text).is_err(), "{text:?}");
        }
        assert!(decode_declaration_codec("\n# empty\n").is_err());
        assert!(decode_declaration_codec("{}\n# trailing trivia\n\n").is_ok());
    }
}

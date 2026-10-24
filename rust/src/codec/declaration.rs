//! Encode and decode ModuleDeclaration values as data-codec records.

use crate::json::{JsonValue, ObjectMap};
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
    let document =
        crate::codec::data::DataDocument::from_codec(text).map_err(|error| error.to_string())?;
    uffda_heap::rootless_mutate(|mc| heap_to_json(document.materialize(mc)))
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

fn heap_to_json(value: Value<'_>) -> Result<JsonValue, String> {
    enum Work<'gc> {
        Visit(Value<'gc>),
        Array(usize),
        Object(Vec<RuntimeString>),
    }
    let mut stack = vec![Work::Visit(value)];
    let mut values = Vec::new();
    while let Some(work) = stack.pop() {
        match work {
            Work::Visit(value) => match value.raw() {
                Value::Null => values.push(JsonValue::Null),
                Value::Boolean(value) => values.push(JsonValue::Bool(value)),
                Value::Number(value) => {
                    let number = serde_json::Number::from_f64(value).ok_or_else(|| {
                        format!("declaration number {value} is not JSON-serializable")
                    })?;
                    values.push(JsonValue::Number(number));
                }
                Value::String(value) => values.push(JsonValue::String((*value).clone())),
                Value::Array(items) => {
                    let items = items.borrow();
                    stack.push(Work::Array(items.len()));
                    for item in items.iter().rev() {
                        stack.push(Work::Visit(*item));
                    }
                }
                Value::Object(object) => {
                    let properties = object.borrow();
                    if !properties.symbol_entries().is_empty() {
                        return Err("declaration objects cannot have symbol keys".into());
                    }
                    let keys: Vec<_> = properties
                        .entries()
                        .iter()
                        .map(|(key, _)| key.clone())
                        .collect();
                    let items: Vec<_> = properties
                        .entries()
                        .iter()
                        .map(|(_, value)| *value)
                        .collect();
                    stack.push(Work::Object(keys));
                    for item in items.into_iter().rev() {
                        stack.push(Work::Visit(item));
                    }
                }
                other => {
                    return Err(format!(
                        "declaration codec value cannot be {}",
                        other.runtime_type()
                    ));
                }
            },
            Work::Array(count) => {
                let start = values
                    .len()
                    .checked_sub(count)
                    .ok_or_else(|| "invalid declaration array".to_string())?;
                let children = values.split_off(start);
                values.push(JsonValue::Array(children));
            }
            Work::Object(keys) => {
                let start = values
                    .len()
                    .checked_sub(keys.len())
                    .ok_or_else(|| "invalid declaration object".to_string())?;
                let children = values.split_off(start);
                let mut map = ObjectMap::new();
                for (key, child) in keys.into_iter().zip(children) {
                    map.insert(key, child);
                }
                values.push(JsonValue::Object(map));
            }
        }
    }
    let value = values
        .pop()
        .ok_or_else(|| "declaration did not produce a value".to_string())?;
    if !value.is_object() {
        return Err("declaration must be a ModuleDeclaration".into());
    }
    Ok(value)
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
        assert_eq!(back.exports[0]["name"], "Main");
        assert_eq!(back.rules[0]["name"], "Main");
        assert_eq!(back.rules[0]["pattern"]["kind"], "any");
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

use crate::text::RuntimeString;
use crate::value::Value;
use std::collections::HashSet;
use std::fmt;
use uffda_heap::Gc;

#[derive(Debug, PartialEq, Eq)]
pub enum OutputError {
    CircularValue,
    Encoding(String),
}

impl fmt::Display for OutputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CircularValue => write!(f, "cannot serialize a circular value"),
            Self::Encoding(message) => write!(f, "cannot encode output: {message}"),
        }
    }
}

impl std::error::Error for OutputError {}

/// Encodes one lossless data record, independently of runtime conversion hooks.
pub fn codec_output(value: Value<'_>) -> Result<String, OutputError> {
    let limits = crate::codec::data::DataLimits::default();
    let document = crate::codec::data::DataDocument::from_value(value, limits)
        .map_err(|error| OutputError::Encoding(error.to_string()))?;
    let source = document
        .encode(false, limits)
        .map_err(|error| OutputError::Encoding(error.to_string()))?;
    Ok(format!("{source}\n"))
}

enum Frame<'gc> {
    Value(Value<'gc>),
    Text(String),
    Leave(usize),
}

fn quote(text: &RuntimeString) -> Result<String, OutputError> {
    let mut output = String::new();
    text.write_json_string(&mut output)
        .map_err(|error| OutputError::Encoding(error.to_string()))?;
    Ok(output)
}

fn omitted(value: Value<'_>) -> bool {
    matches!(value.raw(), Value::Undefined | Value::Symbol(_))
}

enum UffdaFrame<'gc> {
    Value(Value<'gc>),
    Array(crate::value::Array<'gc>, usize),
    Object(crate::value::Object<'gc>, usize),
}

fn uffda_quote(text: &RuntimeString) -> Result<String, OutputError> {
    text.to_utf8()
        .map_err(|error| OutputError::Encoding(error.to_string()))?;
    for unit in text.as_utf16() {
        if (*unit < 0x20 || (0x7f..=0x9f).contains(unit)) && !matches!(*unit, 0x09 | 0x0a | 0x0d) {
            return Err(OutputError::Encoding(format!(
                "Uffda display does not support control character U+{:04X}",
                unit
            )));
        }
    }
    Ok(quote(text)?.replace('{', "\\{"))
}

fn unsupported_display(name: &str) -> OutputError {
    OutputError::Encoding(format!("Uffda display does not support {name}"))
}

/// Displays values as Uffda expressions using O(depth) traversal state.
/// Top-level strings are raw text, and top-level undefined produces no output.
pub fn uffda_output(value: Value<'_>) -> Result<String, OutputError> {
    match value.raw() {
        Value::String(text) => {
            return Ok(format!(
                "{}\n",
                text.to_utf8()
                    .map_err(|error| OutputError::Encoding(error.to_string()))?
            ));
        }
        Value::Undefined => return Ok(String::new()),
        _ => {}
    }
    let mut frames = vec![UffdaFrame::Value(value)];
    let mut ancestors = HashSet::new();
    let mut output = String::new();
    while let Some(frame) = frames.pop() {
        match frame {
            UffdaFrame::Array(array, index) => {
                let values = array.borrow();
                if let Some(value) = values.get(index) {
                    if index != 0 {
                        output.push(' ');
                    }
                    frames.push(UffdaFrame::Array(array, index + 1));
                    frames.push(UffdaFrame::Value(*value));
                } else {
                    output.push(']');
                    ancestors.remove(&(Gc::as_ptr(array) as usize));
                }
            }
            UffdaFrame::Object(object, index) => {
                let properties = object.borrow();
                if let Some((name, value)) = properties.entries().get(index) {
                    if index != 0 {
                        output.push_str(", ");
                    }
                    output.push('[');
                    output.push_str(&uffda_quote(name)?);
                    output.push_str("]: ");
                    frames.push(UffdaFrame::Object(object, index + 1));
                    frames.push(UffdaFrame::Value(*value));
                } else {
                    output.push('}');
                    ancestors.remove(&(Gc::as_ptr(object) as usize));
                }
            }
            UffdaFrame::Value(value) => match value.raw() {
                Value::Undefined => output.push_str("undefined"),
                Value::Null => output.push_str("null"),
                Value::Boolean(value) => output.push_str(if value { "true" } else { "false" }),
                Value::Number(value) => {
                    if !value.is_finite()
                        || value.fract() != 0.0
                        || value.abs() > 9_007_199_254_740_991.0
                        || (value == 0.0 && value.is_sign_negative())
                    {
                        return Err(unsupported_display("this number"));
                    }
                    if value < 0.0 {
                        output.push_str(&format!("(sub 0 {:.0})", -value));
                    } else {
                        output.push_str(&format!("{value:.0}"));
                    }
                }
                Value::String(text) => output.push_str(&uffda_quote(&text)?),
                Value::BigInt(_) => return Err(unsupported_display("BigInt values")),
                Value::Array(array) => {
                    if !ancestors.insert(Gc::as_ptr(array) as usize) {
                        return Err(OutputError::CircularValue);
                    }
                    output.push('[');
                    frames.push(UffdaFrame::Array(array, 0));
                }
                Value::Object(object) => {
                    if !object.borrow().symbol_entries().is_empty() {
                        return Err(unsupported_display("symbol object keys"));
                    }
                    if !ancestors.insert(Gc::as_ptr(object) as usize) {
                        return Err(OutputError::CircularValue);
                    }
                    output.push('{');
                    frames.push(UffdaFrame::Object(object, 0));
                }
                Value::Lambda(_)
                | Value::Native(_)
                | Value::Host(_)
                | Value::IteratorFactory(_) => {
                    return Err(unsupported_display("callable values"));
                }
                Value::Map(_) => return Err(unsupported_display("Map values")),
                Value::Set(_) => return Err(unsupported_display("Set values")),
                Value::Iterable(_) => return Err(unsupported_display("iterable values")),
                Value::InputSource(_) => return Err(unsupported_display("external input sources")),
                Value::Bytes(_) => return Err(unsupported_display("Bytes values")),
                Value::Url(_) => return Err(unsupported_display("URL values")),
                Value::Date(_) => return Err(unsupported_display("Date values")),
                Value::Error(_) => return Err(unsupported_display("Error values")),
                Value::Match(_) => return Err(unsupported_display("match scopes")),
                Value::Declaration(_) => return Err(unsupported_display("declarations")),
                Value::Symbol(_) => return Err(unsupported_display("Symbol values")),
                Value::Located(_) => unreachable!("raw values are not wrapped"),
            },
        }
    }
    output.push('\n');
    Ok(output)
}

fn pretty_json(compact: &str) -> String {
    let mut output = String::new();
    let mut characters = compact.chars().peekable();
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;
    let indent = |output: &mut String, depth: usize| {
        output.push('\n');
        for _ in 0..depth {
            output.push_str("  ");
        }
    };
    while let Some(character) = characters.next() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }
        match character {
            '"' => {
                in_string = true;
                output.push(character);
            }
            '[' | '{' => {
                output.push(character);
                if characters
                    .peek()
                    .is_some_and(|next| *next == ']' || *next == '}')
                {
                    output.push(characters.next().expect("peeked closing delimiter"));
                } else {
                    depth += 1;
                    indent(&mut output, depth);
                }
            }
            ']' | '}' => {
                depth -= 1;
                indent(&mut output, depth);
                output.push(character);
            }
            ',' => {
                output.push(',');
                indent(&mut output, depth);
            }
            ':' => output.push_str(": "),
            _ => output.push(character),
        }
    }
    output
}

pub(crate) fn serialized_output(value: Value<'_>) -> Result<String, OutputError> {
    match value.raw() {
        Value::String(text) => {
            Ok(serialized_json_output(Some(&text.to_utf8().map_err(
                |error| OutputError::Encoding(error.to_string()),
            )?)))
        }
        Value::Undefined => Ok(serialized_json_output(None)),
        _ => Err(OutputError::Encoding(
            "JSON serializer returned neither text nor undefined".into(),
        )),
    }
}

pub(crate) fn serialized_json_output(text: Option<&str>) -> String {
    match text {
        Some(text) => format!("{}\n", pretty_json(text)),
        None => "undefined\n".into(),
    }
}

/// Encodes the current JSON-visible value surface without recursive traversal.
pub fn operation_output(value: Value<'_>, json: bool) -> Result<String, OutputError> {
    if omitted(value) {
        return Ok(if !json && matches!(value.raw(), Value::Undefined) {
            String::new()
        } else {
            "undefined\n".into()
        });
    }
    if !json && let Value::String(text) = value.raw() {
        return Ok(format!(
            "{}\n",
            text.to_utf8()
                .map_err(|error| OutputError::Encoding(error.to_string()))?
        ));
    }
    let mut frames = vec![Frame::Value(value)];
    let mut ancestors = HashSet::new();
    let mut output = String::new();
    while let Some(frame) = frames.pop() {
        match frame {
            Frame::Text(text) => output.push_str(&text),
            Frame::Leave(pointer) => {
                ancestors.remove(&pointer);
            }
            Frame::Value(value) => match value.raw() {
                Value::Undefined | Value::Symbol(_) | Value::Null => output.push_str("null"),
                Value::Lambda(_)
                | Value::Native(_)
                | Value::Host(_)
                | Value::IteratorFactory(_) => {
                    return Err(OutputError::Encoding(
                        "callable values cannot be serialized".into(),
                    ));
                }
                Value::BigInt(_) => {
                    return Err(OutputError::Encoding(
                        "BigInt values require the Uffda data codec".into(),
                    ));
                }
                Value::Map(_) | Value::Set(_) | Value::Iterable(_) | Value::InputSource(_) => {
                    output.push_str("{}")
                }
                Value::Match(_) => {
                    return Err(OutputError::Encoding(
                        "current match scope serialization is not supported".into(),
                    ));
                }
                Value::Bytes(bytes) => {
                    output.push('{');
                    for (index, byte) in bytes.iter().enumerate() {
                        if index != 0 {
                            output.push(',');
                        }
                        output.push_str(&quote(&index.to_string().into())?);
                        output.push(':');
                        output.push_str(&byte.to_string());
                    }
                    output.push('}');
                }
                Value::Boolean(value) => output.push_str(if value { "true" } else { "false" }),
                Value::Number(value) => {
                    if value.is_finite() {
                        output.push_str(&crate::coercion::number_text(value));
                    } else {
                        output.push_str("null");
                    }
                }
                Value::String(text) => output.push_str(&quote(&text)?),
                Value::Url(url) => output.push_str(&quote(&url.0.as_str().into())?),
                Value::Date(date) => {
                    let date = date.0.to_offset(time::UtcOffset::UTC);
                    let formatted = date
                        .format(&time::format_description::well_known::Rfc3339)
                        .map_err(|error| OutputError::Encoding(error.to_string()))?;
                    output.push_str(&quote(&formatted.into())?);
                }
                Value::Error(_) => output.push_str("{}"),
                Value::Declaration(declaration) => {
                    frames.push(Frame::Value(Value::Object(declaration.properties)));
                }
                Value::Array(array) => {
                    let pointer = Gc::as_ptr(array) as usize;
                    if !ancestors.insert(pointer) {
                        return Err(OutputError::CircularValue);
                    }
                    frames.push(Frame::Leave(pointer));
                    frames.push(Frame::Text("]".into()));
                    let values = array.borrow();
                    for (index, value) in values.iter().enumerate().rev() {
                        frames.push(Frame::Value(*value));
                        if index != 0 {
                            frames.push(Frame::Text(",".into()));
                        }
                    }
                    output.push('[');
                }
                Value::Object(properties) => {
                    let pointer = Gc::as_ptr(properties) as usize;
                    if !ancestors.insert(pointer) {
                        return Err(OutputError::CircularValue);
                    }
                    frames.push(Frame::Leave(pointer));
                    frames.push(Frame::Text("}".into()));
                    let properties = properties.borrow();
                    let mut entries: Vec<_> = properties
                        .entries()
                        .iter()
                        .filter(|(_, value)| !omitted(*value))
                        .collect();
                    // JavaScript enumerates array-index keys before other string keys.
                    entries.sort_by_key(|(name, _)| {
                        name.as_scalar_str()
                            .and_then(|name| name.parse::<u32>().ok())
                            .filter(|index| *index != u32::MAX && *name == index.to_string())
                            .map(|index| (false, index))
                            .unwrap_or((true, 0))
                    });
                    for (index, (name, value)) in entries.into_iter().enumerate().rev() {
                        frames.push(Frame::Value(*value));
                        frames.push(Frame::Text(":".into()));
                        frames.push(Frame::Text(quote(name)?));
                        if index != 0 {
                            frames.push(Frame::Text(",".into()));
                        }
                    }
                    output.push('{');
                }
                Value::Located(_) => unreachable!("raw values are not wrapped"),
            },
        }
    }
    let mut formatted = pretty_json(&output);
    formatted.push('\n');
    Ok(formatted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uffda_heap::rootless_mutate;

    #[test]
    // req:cli-exec-002 req:data-codec-003 req:runtime-strings-002
    fn codec_records_include_top_level_strings_undefined_and_native_values() {
        rootless_mutate(|mc| {
            assert_eq!(codec_output(Value::Undefined).unwrap(), "undefined\n");
            assert_eq!(
                codec_output(Value::string(mc, "raw\n\0{")).unwrap(),
                "\"raw\\n\\u0000{\"\n"
            );
            assert_eq!(
                codec_output(Value::string(mc, RuntimeString::from_utf16(vec![0xd800]))).unwrap(),
                "\"\\ud800\"\n"
            );
            assert_eq!(
                codec_output(Value::object(
                    mc,
                    vec![("a".into(), Value::array(mc, vec![Value::Number(-2.5)]))]
                ))
                .unwrap(),
                "{\"a\":[-2.5]}\n"
            );
            assert_eq!(
                codec_output(Value::bigint(mc, num_bigint::BigInt::from(42))).unwrap(),
                "42n\n"
            );
            let shared = Value::array(mc, vec![]);
            assert!(codec_output(Value::array(mc, vec![shared, shared])).is_err());
        });
    }

    #[test]
    // req:runtime-strings-002
    fn json_output_is_lossless_and_scalar_source_display_errors() {
        rootless_mutate(|mc| {
            let text = RuntimeString::from_utf16(vec![0xd800]);
            let value = Value::string(mc, text.clone());
            let object = Value::object(mc, vec![(text, value)]);
            assert_eq!(
                operation_output(object, true).unwrap(),
                "{\n  \"\\ud800\": \"\\ud800\"\n}\n"
            );
            assert!(uffda_output(value).is_err());
            assert!(uffda_output(Value::array(mc, vec![value])).is_err());
            assert!(uffda_output(object).is_err());
        });
    }

    #[test]
    // req:cli-exec-001
    fn serialized_json_is_pretty_printed_without_double_encoding() {
        rootless_mutate(|mc| {
            assert_eq!(
                serialized_output(Value::string(mc, r#"{"value":[1,2]}"#)).unwrap(),
                "{\n  \"value\": [\n    1,\n    2\n  ]\n}\n"
            );
            assert_eq!(serialized_output(Value::Undefined).unwrap(), "undefined\n");
            assert!(serialized_output(Value::Boolean(false)).is_err());
        });
    }

    #[test]
    // req:runtime-core-012 req:cli-exec-002 req:expressions-runtime-010
    fn iterator_method_factories_fail_instead_of_json_omission() {
        rootless_mutate(|mc| {
            let factory = Value::IteratorFactory(Gc::new(mc, Value::array(mc, vec![])));
            assert!(operation_output(factory, true).is_err());
            assert!(operation_output(Value::array(mc, vec![factory]), true).is_err());
            assert!(
                operation_output(Value::object(mc, vec![("iterator".into(), factory)]), true)
                    .is_err()
            );
        });
    }

    #[test]
    // req:data-codec-003 req:cli-exec-002
    fn native_json_values_follow_json_boundaries_and_bigint_fails_explicitly() {
        rootless_mutate(|mc| {
            let date = Value::date(
                mc,
                time::OffsetDateTime::parse(
                    "2026-10-10T18:00:00.123-05:00",
                    &time::format_description::well_known::Rfc3339,
                )
                .unwrap(),
            );
            let error = Value::error(mc, "TypeError".into(), "invalid".into(), None, None);
            let bigint = Value::bigint(mc, num_bigint::BigInt::from(42));
            assert_eq!(
                operation_output(date, true).unwrap(),
                "\"2026-10-10T23:00:00.123Z\"\n"
            );
            assert_eq!(operation_output(error, true).unwrap(), "{}\n");
            assert!(
                operation_output(bigint, true)
                    .unwrap_err()
                    .to_string()
                    .contains("BigInt")
            );
            assert!(uffda_output(bigint).is_err());
        });
    }

    #[test]
    // req:cli-exec-002
    fn uffda_scalars_and_collections_use_expression_not_json_notation() {
        rootless_mutate(|mc| {
            assert_eq!(uffda_output(Value::Undefined).unwrap(), "");
            assert_eq!(
                uffda_output(Value::string(mc, "raw\n\0{")).unwrap(),
                "raw\n\0{\n"
            );
            assert_eq!(uffda_output(Value::Null).unwrap(), "null\n");
            assert_eq!(uffda_output(Value::Boolean(false)).unwrap(), "false\n");
            assert_eq!(uffda_output(Value::array(mc, vec![])).unwrap(), "[]\n");
            assert_eq!(uffda_output(Value::object(mc, vec![])).unwrap(), "{}\n");
            let value = Value::object(
                mc,
                vec![
                    (
                        "key".into(),
                        Value::array(mc, vec![Value::Number(1.0), Value::Number(2.0)]),
                    ),
                    ("other".into(), Value::Undefined),
                    ("null".into(), Value::Null),
                    ("boolean".into(), Value::Boolean(true)),
                ],
            );
            assert_eq!(
                uffda_output(value).unwrap(),
                "{[\"key\"]: [1 2], [\"other\"]: undefined, [\"null\"]: null, [\"boolean\"]: true}\n"
            );
            assert_eq!(
                uffda_output(Value::array(mc, vec![Value::Undefined, Value::Null])).unwrap(),
                "[undefined null]\n"
            );
            assert_eq!(
                uffda_output(value.wrap(mc, crate::provenance::Origin { start: 0, end: 1 }))
                    .unwrap(),
                uffda_output(value).unwrap()
            );
        });
    }

    #[test]
    // req:cli-exec-002
    fn uffda_escaping_preserves_strings_and_computed_keys() {
        rootless_mutate(|mc| {
            let text = "\\\"{\t\n\r} café";
            let expected = "\"\\\\\\\"\\{\\t\\n\\r} café\"";
            assert_eq!(
                uffda_output(Value::array(mc, vec![Value::string(mc, text)])).unwrap(),
                format!("[{expected}]\n")
            );
            assert_eq!(
                uffda_output(Value::object(mc, vec![(text.into(), Value::Number(1.0))])).unwrap(),
                format!("{{[{expected}]: 1}}\n")
            );
            for control in [
                '\0', '\u{0008}', '\u{000c}', '\u{001f}', '\u{007f}', '\u{0085}',
            ] {
                let text = control.to_string();
                assert!(uffda_output(Value::array(mc, vec![Value::string(mc, &text)])).is_err());
                assert!(uffda_output(Value::object(mc, vec![(text.into(), Value::Null)])).is_err());
            }
        });
    }

    #[test]
    // req:cli-exec-002
    fn uffda_numbers_only_use_lossless_grammar_supported_forms() {
        for (value, expected) in [
            (0.0, "0\n"),
            (42.0, "42\n"),
            (-42.0, "(sub 0 42)\n"),
            (9_007_199_254_740_991.0, "9007199254740991\n"),
            (-9_007_199_254_740_991.0, "(sub 0 9007199254740991)\n"),
        ] {
            assert_eq!(uffda_output(Value::Number(value)).unwrap(), expected);
        }
        for value in [
            -0.0,
            0.25,
            -1.5,
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
            9_007_199_254_740_992.0,
            1e100,
            f64::MIN_POSITIVE,
        ] {
            assert!(matches!(
                uffda_output(Value::Number(value)),
                Err(OutputError::Encoding(_))
            ));
        }
    }

    #[test]
    // req:cli-exec-002 req:runtime-core-012 req:runtime-core-013
    fn callable_values_are_errors_in_all_output_positions_without_hooks() {
        use crate::environment::Environment;
        use crate::evaluate::CompiledExpression;
        use crate::expression::Expression;
        use crate::globals::NativeGlobal;
        use crate::pattern::Pattern;
        use crate::provenance::Origin;
        rootless_mutate(|mc| {
            let lambda = CompiledExpression::new(Expression::Number { value: 1.0 }).bind(
                mc,
                Environment::new(mc, None, vec![]),
                Origin { start: 0, end: 0 },
                Pattern::Any,
            );
            for callable in [
                lambda,
                Value::Native(NativeGlobal::Id),
                Value::host(
                    mc,
                    crate::value::HostCallable {
                        id: 1,
                        name: "private".into(),
                        arity: 0,
                    },
                ),
                Value::IteratorFactory(Gc::new(mc, Value::array(mc, vec![]))),
            ] {
                for value in [
                    callable,
                    Value::array(mc, vec![callable]),
                    Value::object(mc, vec![("json".into(), callable)]),
                    Value::object(mc, vec![("toJSON".into(), callable)]),
                ] {
                    assert!(matches!(uffda_output(value), Err(OutputError::Encoding(_))));
                    assert!(matches!(
                        operation_output(value, true),
                        Err(OutputError::Encoding(_))
                    ));
                    assert!(matches!(
                        operation_output(value, false),
                        Err(OutputError::Encoding(_))
                    ));
                }
            }
        });
    }

    #[test]
    // req:cli-exec-002
    fn non_expression_values_and_symbol_keys_fail_without_conversion() {
        use crate::globals::IterableState;
        use uffda_heap::RefLock;
        rootless_mutate(|mc| {
            let array = match Value::array(mc, vec![]) {
                Value::Array(array) => array,
                _ => unreachable!(),
            };
            for value in [
                Value::Map(array),
                Value::Set(array),
                Value::Bytes(Gc::new(mc, vec![1, 2])),
                Value::Url(Gc::new(
                    mc,
                    crate::value::RuntimeUrl(url::Url::parse("file:///output.uff").unwrap()),
                )),
                Value::Symbol(Gc::new(mc, "symbol".into())),
                Value::Iterable(Gc::new(
                    mc,
                    RefLock::new(IterableState::Deferred { value: Value::Null }),
                )),
            ] {
                assert!(matches!(uffda_output(value), Err(OutputError::Encoding(_))));
                assert!(uffda_output(Value::array(mc, vec![value])).is_err());
                assert!(uffda_output(Value::object(mc, vec![("value".into(), value)])).is_err());
            }
            let object = Value::object(mc, vec![]);
            let Value::Object(properties) = object else {
                unreachable!()
            };
            properties
                .borrow_mut(mc)
                .set_symbol("hidden".into(), Value::Null);
            assert!(matches!(
                uffda_output(object),
                Err(OutputError::Encoding(_))
            ));
        });
    }

    #[test]
    // req:cli-exec-002 req:runtime-memory-001
    fn uffda_cycles_fail_but_shared_siblings_preserve_own_order() {
        rootless_mutate(|mc| {
            let shared = Value::object(
                mc,
                vec![
                    ("b".into(), Value::Number(3.0)),
                    ("2".into(), Value::Number(2.0)),
                    ("1".into(), Value::Number(1.0)),
                ],
            );
            assert_eq!(
                uffda_output(Value::array(mc, vec![shared, shared])).unwrap(),
                "[{[\"1\"]: 1, [\"2\"]: 2, [\"b\"]: 3} {[\"1\"]: 1, [\"2\"]: 2, [\"b\"]: 3}]\n"
            );
            let array = Value::array(mc, vec![]);
            let Value::Array(values) = array else {
                unreachable!()
            };
            values.borrow_mut(mc).push(array);
            assert_eq!(uffda_output(array).unwrap_err(), OutputError::CircularValue);
            let object = Value::object(mc, vec![]);
            let Value::Object(properties) = object else {
                unreachable!()
            };
            properties.borrow_mut(mc).set("self".into(), object);
            assert_eq!(
                uffda_output(object).unwrap_err(),
                OutputError::CircularValue
            );
            let array = Value::array(mc, vec![object]);
            properties.borrow_mut(mc).set("self".into(), array);
            assert_eq!(uffda_output(array).unwrap_err(), OutputError::CircularValue);
        });
    }

    #[test]
    // req:cli-exec-002 req:runtime-memory-005
    fn uffda_twenty_thousand_nested_and_wide_values_use_bounded_stack() {
        rootless_mutate(|mc| {
            let mut value = Value::Number(42.0);
            for index in 0..20_000 {
                value = if index % 2 == 0 {
                    Value::array(mc, vec![value])
                } else {
                    Value::object(mc, vec![("x".into(), value)])
                };
            }
            let text = uffda_output(value).unwrap();
            assert_eq!(text.len(), 110_003);
            assert!(text.contains("[42]"));
            let value = Value::array(mc, vec![Value::Number(1.0); 20_000]);
            let text = uffda_output(value).unwrap();
            assert_eq!(text.len(), 40_002);
            assert_eq!(text.bytes().filter(|byte| *byte == b'1').count(), 20_000);
        });
    }

    #[test]
    // req:cli-exec-001 req:cli-exec-002 req:rule-decorators-006
    fn urls_and_canonical_declaration_properties_are_json_visible() {
        use crate::module::{CompiledModuleGraph, ModuleBindings};
        use crate::resolver::{Resolver, decode_declaration};
        let cwd = std::env::current_dir().unwrap();
        let url = url::Url::from_file_path(cwd.join("output.json")).unwrap();
        let mut resolver = Resolver::new(cwd.clone(), cwd.join("bin")).unwrap();
        resolver.insert_declaration(url.clone(), decode_declaration(&url,
            r#"{"imports":[],"exports":[{"kind":"rule","name":"Main"}],"rules":[{"name":"Main","parameters":[],"pattern":{"kind":"any"}}]}"#).unwrap());
        let compiled = CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap();
        rootless_mutate(|mc| {
            let bindings = ModuleBindings::new(mc, &compiled).unwrap();
            let member = compiled.resolve(&url, "Main").unwrap();
            assert!(matches!(
                uffda_output(bindings.declaration(&member).unwrap()),
                Err(OutputError::Encoding(_))
            ));
            let output = operation_output(bindings.declaration(&member).unwrap(), true).unwrap();
            let object: serde_json::Value = serde_json::from_str(&output).unwrap();
            assert_eq!(object["name"], "Main");
            let output = operation_output(
                Value::Url(Gc::new(mc, crate::value::RuntimeUrl(url.clone()))),
                true,
            )
            .unwrap();
            assert_eq!(
                serde_json::from_str::<String>(&output).unwrap(),
                url.as_str()
            );
        });
    }

    #[test]
    // req:expressions-runtime-010 req:cli-exec-001 req:cli-exec-002
    fn whole_match_output_is_explicitly_unsupported_not_fake_empty_object() {
        rootless_mutate(|mc| {
            let mut execution = crate::pattern::PatternExecution::new(
                mc,
                crate::pattern::Pattern::Ok,
                vec![],
                crate::environment::Environment::new(mc, None, vec![]),
            );
            while !execution.step(mc).unwrap() {}
            assert!(matches!(
                operation_output(Value::Match(execution.result().unwrap()), true),
                Err(OutputError::Encoding(_))
            ));
            assert!(matches!(
                uffda_output(Value::Match(execution.result().unwrap())),
                Err(OutputError::Encoding(_))
            ));
        });
    }

    #[test]
    // req:cli-exec-001
    fn text_json_undefined_and_nonfinite_outputs() {
        rootless_mutate(|mc| {
            let text = Value::string(mc, "hello\nworld");
            assert_eq!(operation_output(text, false).unwrap(), "hello\nworld\n");
            assert_eq!(operation_output(text, true).unwrap(), "\"hello\\nworld\"\n");
            assert_eq!(
                operation_output(Value::Undefined, true).unwrap(),
                "undefined\n"
            );
            assert_eq!(operation_output(Value::Undefined, false).unwrap(), "");
            let array = Value::array(mc, vec![Value::Undefined, Value::Number(f64::NAN)]);
            assert_eq!(
                operation_output(array, true).unwrap(),
                "[\n  null,\n  null\n]\n"
            );
        });
    }

    #[test]
    // req:cli-exec-001 req:runtime-memory-001
    fn shared_objects_are_not_cycles_and_numeric_keys_are_ordered() {
        rootless_mutate(|mc| {
            let object = Value::object(
                mc,
                vec![
                    ("b".into(), Value::Number(3.0)),
                    ("2".into(), Value::Number(2.0)),
                    ("1".into(), Value::Number(1.0)),
                    ("missing".into(), Value::Undefined),
                ],
            );
            assert_eq!(
                operation_output(object, true).unwrap(),
                "{\n  \"1\": 1,\n  \"2\": 2,\n  \"b\": 3\n}\n"
            );
            assert!(operation_output(Value::array(mc, vec![object, object]), true).is_ok());
            let array = Value::array(mc, vec![]);
            let Value::Array(storage) = array else {
                panic!("expected array");
            };
            storage.borrow_mut(mc).push(array);
            assert_eq!(
                operation_output(array, true).unwrap_err(),
                OutputError::CircularValue
            );
        });
    }

    #[test]
    // req:cli-exec-001 req:runtime-memory-005
    fn deeply_nested_output_does_not_recurse() {
        rootless_mutate(|mc| {
            let mut value = Value::Number(42.0);
            for _ in 0..1_000 {
                value = Value::array(mc, vec![value]);
            }
            let text = operation_output(value, true).unwrap();
            assert!(text.len() > 2_000_000);
            assert!(text.contains("42"));
        });
    }

    #[test]
    // req:cli-exec-001
    fn rooted_json_text_is_pretty_printed_without_double_encoding() {
        assert_eq!(serialized_json_output(None), "undefined\n");
        assert_eq!(serialized_json_output(Some("\"text\"")), "\"text\"\n");
        assert_eq!(
            serialized_json_output(Some("{\"answer\":42}")),
            "{\n  \"answer\": 42\n}\n"
        );
    }
}
#[test]
// req:runtime-core-014
fn external_source_output_never_pulls_input_or_serializes_pending_work() {
    uffda_heap::rootless_mutate(|mc| {
        let source = crate::runtime::input::InputSource::new(
            mc,
            crate::runtime::input::Source {
                id: 1,
                name: "source".into(),
            },
        );
        assert!(uffda_output(Value::InputSource(source)).is_err());
        assert!(!source.pending());
        assert_eq!(
            operation_output(Value::InputSource(source), true).unwrap(),
            "{}\n"
        );
    });
}

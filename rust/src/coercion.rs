use crate::value::{Array, Value};
use gc_arena::Gc;
use std::collections::HashSet;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StringCoercionError {
    CannotConvertObject,
    CyclicArray,
    CallableConversion,
}

impl fmt::Display for StringCoercionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CannotConvertObject => write!(f, "cannot convert object to primitive value"),
            Self::CyclicArray => write!(f, "cyclic array string conversion is not implemented"),
            Self::CallableConversion => write!(f, "callable string conversion is not implemented"),
        }
    }
}

impl std::error::Error for StringCoercionError {}

pub fn truthy(value: Value<'_>) -> bool {
    match value.raw() {
        Value::Null | Value::Undefined => false,
        Value::Boolean(value) => value,
        Value::Number(value) => value != 0.0 && !value.is_nan(),
        Value::String(value) => !value.is_empty(),
        Value::Array(_) | Value::Object(_) | Value::Lambda(_) => true,
        Value::Located(_) => unreachable!("wrappers cannot contain wrappers"),
    }
}

pub fn number_text(value: f64) -> String {
    ryu_js::Buffer::new().format(value).to_owned()
}

enum TextFrame<'gc> {
    Value(Value<'gc>),
    ArrayItem(Array<'gc>, usize),
}

pub fn string_text(value: Value<'_>) -> Result<String, StringCoercionError> {
    let mut frames = vec![TextFrame::Value(value)];
    let mut ancestors = HashSet::new();
    let mut output = String::new();
    while let Some(frame) = frames.pop() {
        match frame {
            TextFrame::Value(value) => match value.raw() {
                Value::Undefined => output.push_str("undefined"),
                Value::Null => output.push_str("null"),
                Value::Boolean(value) => output.push_str(if value { "true" } else { "false" }),
                Value::Number(value) => output.push_str(&number_text(value)),
                Value::String(value) => output.push_str(&value),
                Value::Object(properties) => {
                    // Own non-callable toString shadows the inherited conversion method.
                    if properties.borrow().get("toString").is_some() {
                        return Err(StringCoercionError::CannotConvertObject);
                    }
                    output.push_str("[object Object]");
                }
                Value::Array(array) => {
                    if !ancestors.insert(Gc::as_ptr(array)) {
                        return Err(StringCoercionError::CyclicArray);
                    }
                    frames.push(TextFrame::ArrayItem(array, 0));
                }
                Value::Lambda(_) => return Err(StringCoercionError::CallableConversion),
                Value::Located(_) => unreachable!("wrappers cannot contain wrappers"),
            },
            TextFrame::ArrayItem(array, index) => {
                let item = array.borrow().get(index).copied();
                if let Some(item) = item {
                    if index != 0 {
                        output.push(',');
                    }
                    frames.push(TextFrame::ArrayItem(array, index + 1));
                    // Array joining renders null and undefined as empty entries.
                    if !matches!(item.raw(), Value::Null | Value::Undefined) {
                        frames.push(TextFrame::Value(item));
                    }
                } else {
                    ancestors.remove(&Gc::as_ptr(array));
                }
            }
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::arena::rootless_mutate;

    #[test]
    // req:expressions-runtime-004
    fn unsupported_cyclic_conversion_fails_instead_of_looping() {
        rootless_mutate(|mc| {
            let value = Value::array(mc, vec![]);
            let Value::Array(array) = value else {
                panic!("expected array");
            };
            array.borrow_mut(mc).push(value);
            assert_eq!(
                string_text(value).unwrap_err(),
                StringCoercionError::CyclicArray
            );
        });
    }

    #[test]
    // req:expressions-runtime-007
    fn truthiness_preserves_javascript_primitive_and_aggregate_rules() {
        rootless_mutate(|mc| {
            for value in [
                Value::Undefined,
                Value::Null,
                Value::Boolean(false),
                Value::Number(0.0),
                Value::Number(-0.0),
                Value::Number(f64::NAN),
                Value::string(mc, ""),
            ] {
                assert!(!truthy(value));
            }
            for value in [
                Value::Boolean(true),
                Value::Number(-1.0),
                Value::Number(f64::INFINITY),
                Value::string(mc, "false"),
                Value::array(mc, vec![]),
                Value::object(mc, vec![]),
            ] {
                assert!(truthy(value));
            }
            let origin = crate::provenance::Origin { start: 2, end: 5 };
            assert!(!truthy(Value::Number(f64::NAN).wrap(mc, origin)));
            assert!(truthy(Value::array(mc, vec![]).wrap(mc, origin)));
        });
    }

    #[test]
    // req:expressions-runtime-004
    fn number_conversion_covers_nonfinite_values_and_exponent_thresholds() {
        for (number, expected) in [
            (-0.0, "0"),
            (f64::NAN, "NaN"),
            (f64::INFINITY, "Infinity"),
            (f64::NEG_INFINITY, "-Infinity"),
            (1e21, "1e+21"),
            (1e20, "100000000000000000000"),
            (1e-6, "0.000001"),
            (1e-7, "1e-7"),
        ] {
            assert_eq!(number_text(number), expected);
        }
    }

    #[test]
    // req:expressions-runtime-004
    fn nested_arrays_join_nullish_elements_without_losing_shared_arrays() {
        rootless_mutate(|mc| {
            let shared = Value::array(mc, vec![Value::Number(1.0), Value::Null]);
            let value = Value::array(
                mc,
                vec![shared, shared, Value::Undefined, Value::object(mc, vec![])],
            );
            assert_eq!(string_text(value).unwrap(), "1,,1,,,[object Object]");
            assert_eq!(string_text(Value::Null).unwrap(), "null");
            assert_eq!(string_text(Value::Undefined).unwrap(), "undefined");
        });
    }

    #[test]
    // req:expressions-runtime-004 req:runtime-memory-005
    fn deep_array_string_conversion_is_stack_safe() {
        rootless_mutate(|mc| {
            let mut value = Value::Number(42.0);
            for _ in 0..20_000 {
                value = Value::array(mc, vec![value]);
            }
            assert_eq!(string_text(value).unwrap(), "42");
        });
    }

    #[test]
    // req:expressions-runtime-004
    fn object_conversion_errors_are_explicit() {
        rootless_mutate(|mc| {
            let value = Value::object(mc, vec![("toString".into(), Value::Number(42.0))]);
            assert_eq!(
                string_text(value).unwrap_err(),
                StringCoercionError::CannotConvertObject
            );
        });
    }
}

use crate::value::Value;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StringCoercionError {
    CannotConvertObject,
    CallableConversion,
    CompositeConversion,
}

impl fmt::Display for StringCoercionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CannotConvertObject => write!(f, "cannot convert object to primitive value"),
            Self::CallableConversion => write!(f, "cannot convert callable to string"),
            Self::CompositeConversion => write!(f, "cannot convert composite value to string"),
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
        Value::Array(_)
        | Value::Object(_)
        | Value::Declaration(_)
        | Value::Url(_)
        | Value::Lambda(_)
        | Value::Native(_)
        | Value::Host(_)
        | Value::IteratorFactory(_)
        | Value::Symbol(_)
        | Value::Set(_)
        | Value::Map(_)
        | Value::Bytes(_)
        | Value::Iterable(_)
        | Value::Match(_) => true,
        Value::Located(_) => unreachable!("wrappers cannot contain wrappers"),
    }
}

pub fn number_text(value: f64) -> String {
    ryu_js::Buffer::new().format(value).to_owned()
}

pub fn string_text(value: Value<'_>) -> Result<String, StringCoercionError> {
    match value.raw() {
        Value::Undefined => Ok("undefined".into()),
        Value::Null => Ok("null".into()),
        Value::Boolean(value) => Ok(if value { "true" } else { "false" }.into()),
        Value::Number(value) => Ok(number_text(value)),
        Value::String(value) => Ok((*value).clone()),
        Value::Native(_) | Value::Host(_) | Value::Lambda(_) | Value::IteratorFactory(_) => {
            Err(StringCoercionError::CallableConversion)
        }
        Value::Symbol(name) => Ok(crate::globals::symbol_text(&name)),
        Value::Array(_)
        | Value::Object(_)
        | Value::Declaration(_)
        | Value::Url(_)
        | Value::Set(_)
        | Value::Map(_)
        | Value::Bytes(_)
        | Value::Iterable(_)
        | Value::Match(_) => Err(StringCoercionError::CompositeConversion),
        Value::Located(_) => unreachable!("wrappers cannot contain wrappers"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::Gc;
    use gc_arena::arena::rootless_mutate;

    #[test]
    // req:runtime-core-012 req:expressions-runtime-004
    fn scalar_symbols_have_the_same_descriptor_in_all_text_conversions() {
        rootless_mutate(|mc| {
            for (name, expected) in [
                ("iterator", "Symbol(Symbol.iterator)"),
                ("custom", "Symbol(custom)"),
            ] {
                let value = Value::Symbol(Gc::new(mc, name.into()));
                assert_eq!(string_text(value).unwrap(), expected);
                assert_eq!(
                    string_text(value.wrap(mc, crate::provenance::Origin { start: 0, end: 0 }))
                        .unwrap(),
                    expected
                );
            }
        });
    }

    #[test]
    // req:runtime-core-012 req:expressions-runtime-004
    fn all_object_like_values_reject_text_conversion_without_hooks() {
        rootless_mutate(|mc| {
            let origin = crate::provenance::Origin { start: 0, end: 0 };
            let iterator = Value::Iterable(Gc::new(
                mc,
                gc_arena::RefLock::new(crate::globals::IterableState::Source {
                    value: Value::Null,
                    index: 0,
                    offset: 0,
                }),
            ));
            for value in [
                Value::array(mc, vec![]),
                Value::object(mc, vec![]),
                Value::Set(Gc::new(mc, gc_arena::RefLock::new(vec![]))),
                Value::map(mc, vec![]),
                Value::Bytes(Gc::new(mc, vec![])),
                Value::Url(Gc::new(
                    mc,
                    crate::value::RuntimeUrl(url::Url::parse("file:///test").unwrap()),
                )),
                iterator,
            ] {
                assert_eq!(
                    string_text(value),
                    Err(StringCoercionError::CompositeConversion)
                );
                assert_eq!(
                    string_text(value.wrap(mc, origin)),
                    Err(StringCoercionError::CompositeConversion)
                );
            }
        });
    }

    #[test]
    // req:expressions-runtime-004 req:runtime-core-012 req:runtime-core-013
    fn callable_conversion_errors_without_source_or_metadata_disclosure() {
        rootless_mutate(|mc| {
            let environment = crate::environment::Environment::new(mc, None, vec![]);
            let authored =
                crate::evaluate::CompiledExpression::new(crate::expression::Expression::Boolean {
                    value: true,
                })
                .bind(
                    mc,
                    environment,
                    crate::provenance::Origin { start: 0, end: 0 },
                    crate::pattern::Pattern::End,
                );
            for value in [
                authored,
                Value::Native(crate::globals::NativeGlobal::Add),
                Value::host(
                    mc,
                    crate::value::HostCallable {
                        id: 1,
                        name: "private".into(),
                        arity: 0,
                    },
                ),
                Value::IteratorFactory(Gc::new(mc, Value::Null)),
            ] {
                let error = string_text(value).unwrap_err();
                assert!(truthy(value));
                assert_eq!(error, StringCoercionError::CallableConversion);
                assert_eq!(error.to_string(), "cannot convert callable to string");
            }
        });
    }

    #[test]
    // req:expressions-runtime-004 req:expressions-runtime-007 req:runtime-core-012
    fn native_values_and_new_collections_have_explicit_coercion() {
        rootless_mutate(|mc| {
            assert!(truthy(Value::Native(crate::globals::NativeGlobal::Id)));
            assert_eq!(
                string_text(Value::Native(crate::globals::NativeGlobal::Id)),
                Err(StringCoercionError::CallableConversion)
            );
            assert_eq!(
                string_text(Value::IteratorFactory(Gc::new(mc, Value::Null))),
                Err(StringCoercionError::CallableConversion)
            );
            let bytes = Value::Bytes(Gc::new(mc, vec![0, 128, 255]));
            assert_eq!(
                string_text(bytes),
                Err(StringCoercionError::CompositeConversion)
            );
            let set = Value::Set(Gc::new(mc, gc_arena::RefLock::new(vec![])));
            assert_eq!(
                string_text(set),
                Err(StringCoercionError::CompositeConversion)
            );
        });
    }

    #[test]
    // req:expressions-runtime-004 req:runtime-core-012
    fn cyclic_array_conversion_fails_without_traversing_entries() {
        rootless_mutate(|mc| {
            let value = Value::array(mc, vec![]);
            let Value::Array(array) = value else {
                panic!("expected array");
            };
            array.borrow_mut(mc).push(value);
            assert_eq!(
                string_text(value),
                Err(StringCoercionError::CompositeConversion)
            );
            array.borrow_mut(mc).extend([Value::Number(1.0), value]);
            assert_eq!(
                string_text(value),
                Err(StringCoercionError::CompositeConversion)
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
    // req:expressions-runtime-004 req:runtime-core-012
    fn nested_arrays_fail_while_scalar_nullish_representations_are_preserved() {
        rootless_mutate(|mc| {
            let shared = Value::array(mc, vec![Value::Number(1.0), Value::Null]);
            let value = Value::array(
                mc,
                vec![shared, shared, Value::Undefined, Value::object(mc, vec![])],
            );
            assert_eq!(
                string_text(value),
                Err(StringCoercionError::CompositeConversion)
            );
            assert_eq!(string_text(Value::Null).unwrap(), "null");
            assert_eq!(string_text(Value::Undefined).unwrap(), "undefined");
        });
    }

    #[test]
    // req:expressions-runtime-004 req:runtime-memory-005 req:runtime-core-012
    fn deep_array_string_conversion_is_stack_safe() {
        rootless_mutate(|mc| {
            let mut value = Value::Number(42.0);
            for _ in 0..20_000 {
                value = Value::array(mc, vec![value]);
            }
            assert_eq!(
                string_text(value),
                Err(StringCoercionError::CompositeConversion)
            );
        });
    }

    #[test]
    // req:expressions-runtime-004 req:runtime-core-012
    fn object_conversion_errors_are_explicit() {
        rootless_mutate(|mc| {
            let value = Value::object(mc, vec![("toString".into(), Value::Number(42.0))]);
            assert_eq!(
                string_text(value).unwrap_err(),
                StringCoercionError::CompositeConversion
            );
            let tagged = Value::object(mc, vec![]);
            let Value::Object(properties) = tagged else {
                unreachable!()
            };
            properties
                .borrow_mut(mc)
                .set_symbol("toStringTag".into(), Value::string(mc, "Record"));
            assert_eq!(
                string_text(tagged),
                Err(StringCoercionError::CompositeConversion)
            );
        });
    }
}

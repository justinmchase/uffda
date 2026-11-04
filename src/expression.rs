use crate::codec::data::DataDocument;
use crate::pattern::Pattern;
use crate::text::RuntimeString;
use serde::de::{self, DeserializeOwned, MapAccess, Visitor};
use std::collections::HashMap;

#[derive(Debug)]
pub enum Expression {
    Number {
        value: f64,
    },
    Boolean {
        value: bool,
    },
    Value {
        value: Option<DataDocument>,
    },
    Reference {
        name: String,
    },
    Member {
        name: RuntimeString,
        expression: Box<Self>,
    },
    Array {
        expressions: Vec<ArrayInitializer>,
    },
    Object {
        keys: Vec<ObjectInitializer>,
    },
    String {
        values: Vec<StringSegment>,
    },
    Not {
        expression: Box<Self>,
    },
    Invocation {
        expression: Box<Self>,
        args: Vec<InvocationArgument>,
    },
    Lambda {
        pattern: Pattern,
        expression: Box<Self>,
    },
}

impl Expression {
    fn deserialize_fields<E: de::Error>(
        mut fields: HashMap<String, DataDocument>,
    ) -> Result<Self, E> {
        let kind: String = take_field(&mut fields, "kind")?;
        Ok(match kind.as_str() {
            "number" => Self::Number {
                value: take_field(&mut fields, "value")?,
            },
            "boolean" => Self::Boolean {
                value: take_field(&mut fields, "value")?,
            },
            "value" => Self::Value {
                value: take_optional_field(&mut fields, "value")?,
            },
            "reference" => Self::Reference {
                name: take_field(&mut fields, "name")?,
            },
            "member" => Self::Member {
                name: take_field(&mut fields, "name")?,
                expression: Box::new(take_field(&mut fields, "expression")?),
            },
            "array" => Self::Array {
                expressions: take_field(&mut fields, "expressions")?,
            },
            "object" => Self::Object {
                keys: take_field(&mut fields, "keys")?,
            },
            "string" => Self::String {
                values: take_field(&mut fields, "values")?,
            },
            "not" => Self::Not {
                expression: Box::new(take_field(&mut fields, "expression")?),
            },
            "invocation" => Self::Invocation {
                expression: Box::new(take_field(&mut fields, "expression")?),
                args: take_field(&mut fields, "args")?,
            },
            "lambda" => Self::Lambda {
                pattern: take_field(&mut fields, "pattern")?,
                expression: Box::new(take_field(&mut fields, "expression")?),
            },
            _ => {
                return Err(de::Error::unknown_variant(
                    &kind,
                    &[
                        "number",
                        "boolean",
                        "value",
                        "reference",
                        "member",
                        "array",
                        "object",
                        "string",
                        "not",
                        "invocation",
                        "lambda",
                    ],
                ));
            }
        })
    }
}

impl<'de> serde::Deserialize<'de> for Expression {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ExpressionVisitor;

        impl<'de> Visitor<'de> for ExpressionVisitor {
            type Value = Expression;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("an expression object with a kind field")
            }

            fn visit_map<A: MapAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
                Expression::deserialize_fields(collect_fields(access)?)
            }
        }

        deserializer.deserialize_map(ExpressionVisitor)
    }
}

fn collect_fields<'de, A: MapAccess<'de>>(
    mut access: A,
) -> Result<HashMap<String, DataDocument>, A::Error> {
    let mut fields = HashMap::new();
    while let Some(key) = access.next_key::<String>()? {
        let value = access.next_value::<DataDocument>()?;
        if fields.insert(key.clone(), value).is_some() {
            return Err(de::Error::custom(format!("duplicate field `{key}`")));
        }
    }
    Ok(fields)
}

fn take_field<T: DeserializeOwned, E: de::Error>(
    fields: &mut HashMap<String, DataDocument>,
    name: &'static str,
) -> Result<T, E> {
    let document = fields
        .remove(name)
        .ok_or_else(|| de::Error::missing_field(name))?;
    uffda_codec::data::de::from_document(&document).map_err(de::Error::custom)
}

fn take_optional_field<T: DeserializeOwned, E: de::Error>(
    fields: &mut HashMap<String, DataDocument>,
    name: &'static str,
) -> Result<Option<T>, E> {
    fields
        .remove(name)
        .map(|document| {
            if matches!(
                document.nodes()[document.root()],
                crate::codec::data::DataNode::Undefined
            ) {
                Ok(None)
            } else {
                uffda_codec::data::de::from_document(&document)
                    .map(Some)
                    .map_err(de::Error::custom)
            }
        })
        .transpose()
        .map(Option::flatten)
}

#[derive(Debug)]
pub enum InvocationArgument {
    Spread(InvocationSpread),
    Expression(Expression),
}

impl<'de> serde::Deserialize<'de> for InvocationArgument {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ArgumentVisitor;

        impl<'de> Visitor<'de> for ArgumentVisitor {
            type Value = InvocationArgument;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("an expression or invocation spread")
            }

            fn visit_map<A: MapAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
                let mut fields = collect_fields(access)?;
                let kind: String = take_field(&mut fields, "kind")?;
                if kind == "invocationSpread" {
                    Ok(InvocationArgument::Spread(
                        InvocationSpread::InvocationSpread {
                            expression: take_field(&mut fields, "expression")?,
                        },
                    ))
                } else {
                    fields.insert(
                        "kind".into(),
                        DataDocument::from_json(crate::json::JsonValue::String(kind.into()))
                            .map_err(de::Error::custom)?,
                    );
                    Expression::deserialize_fields(fields).map(InvocationArgument::Expression)
                }
            }
        }

        deserializer.deserialize_map(ArgumentVisitor)
    }
}

#[derive(Debug)]
pub enum InvocationSpread {
    InvocationSpread { expression: Expression },
}

#[derive(Debug)]
pub enum StringSegment {
    Literal(RuntimeString),
    Expression(Expression),
}

impl<'de> serde::Deserialize<'de> for StringSegment {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct SegmentVisitor;

        impl<'de> Visitor<'de> for SegmentVisitor {
            type Value = StringSegment;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("a string literal or expression")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                Ok(StringSegment::Literal(value.into()))
            }

            fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
                Ok(StringSegment::Literal(value.into()))
            }

            fn visit_bytes<E: de::Error>(self, value: &[u8]) -> Result<Self::Value, E> {
                RuntimeString::from_wtf8(value)
                    .map(StringSegment::Literal)
                    .map_err(de::Error::custom)
            }

            fn visit_byte_buf<E: de::Error>(self, value: Vec<u8>) -> Result<Self::Value, E> {
                self.visit_bytes(&value)
            }

            fn visit_map<A: MapAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
                Expression::deserialize_fields(collect_fields(access)?)
                    .map(StringSegment::Expression)
            }
        }

        deserializer.deserialize_any(SegmentVisitor)
    }
}

#[derive(Debug)]
pub enum ArrayInitializer {
    ArrayElement { expression: Expression },
    ArraySpread { expression: Expression },
}

impl<'de> serde::Deserialize<'de> for ArrayInitializer {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct InitializerVisitor;

        impl<'de> Visitor<'de> for InitializerVisitor {
            type Value = ArrayInitializer;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("an array initializer")
            }

            fn visit_map<A: MapAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
                let mut fields = collect_fields(access)?;
                match take_field::<String, A::Error>(&mut fields, "kind")?.as_str() {
                    "arrayElement" => Ok(ArrayInitializer::ArrayElement {
                        expression: take_field(&mut fields, "expression")?,
                    }),
                    "arraySpread" => Ok(ArrayInitializer::ArraySpread {
                        expression: take_field(&mut fields, "expression")?,
                    }),
                    kind => Err(de::Error::unknown_variant(
                        kind,
                        &["arrayElement", "arraySpread"],
                    )),
                }
            }
        }

        deserializer.deserialize_map(InitializerVisitor)
    }
}

#[derive(Debug)]
pub enum ObjectInitializer {
    ObjectKey {
        name: RuntimeString,
        expression: Expression,
    },
    ObjectComputedKey {
        key_expression: Expression,
        expression: Expression,
    },
    ObjectSpread {
        expression: Expression,
    },
}

impl<'de> serde::Deserialize<'de> for ObjectInitializer {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct InitializerVisitor;

        impl<'de> Visitor<'de> for InitializerVisitor {
            type Value = ObjectInitializer;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("an object initializer")
            }

            fn visit_map<A: MapAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
                let mut fields = collect_fields(access)?;
                match take_field::<String, A::Error>(&mut fields, "kind")?.as_str() {
                    "objectKey" => Ok(ObjectInitializer::ObjectKey {
                        name: take_field(&mut fields, "name")?,
                        expression: take_field(&mut fields, "expression")?,
                    }),
                    "objectComputedKey" => Ok(ObjectInitializer::ObjectComputedKey {
                        key_expression: take_field(&mut fields, "keyExpression")?,
                        expression: take_field(&mut fields, "expression")?,
                    }),
                    "objectSpread" => Ok(ObjectInitializer::ObjectSpread {
                        expression: take_field(&mut fields, "expression")?,
                    }),
                    kind => Err(de::Error::unknown_variant(
                        kind,
                        &["objectKey", "objectComputedKey", "objectSpread"],
                    )),
                }
            }
        }

        deserializer.deserialize_map(InitializerVisitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:runtime-strings-002
    fn lossless_typed_ast_keeps_segments_member_names_and_object_keys() {
        let ast: Expression = crate::json::from_str(r#"{"kind":"object","keys":[{"kind":"objectKey","name":"\ud800","expression":{"kind":"member","name":"\udfff","expression":{"kind":"string","values":["\ud800","\udc00"]}}}]}"#).unwrap();
        let Expression::Object { keys } = ast else {
            panic!()
        };
        let ObjectInitializer::ObjectKey { name, expression } = &keys[0] else {
            panic!()
        };
        assert_eq!(name.as_utf16(), &[0xd800]);
        let Expression::Member { name, expression } = expression else {
            panic!()
        };
        assert_eq!(name.as_utf16(), &[0xdfff]);
        let Expression::String { values } = &**expression else {
            panic!()
        };
        for (segment, unit) in values.iter().zip([0xd800, 0xdc00]) {
            let StringSegment::Literal(text) = segment else {
                panic!()
            };
            assert_eq!(text.as_utf16(), &[unit]);
        }
    }

    #[test]
    // req:expressions-runtime-003
    fn missing_literal_value_is_undefined_and_explicit_null_remains_null() {
        let undefined: Expression = serde_json::from_str(r#"{"kind":"value"}"#).unwrap();
        assert!(matches!(undefined, Expression::Value { value: None }));
        let null: Expression = serde_json::from_str(r#"{"kind":"value","value":null}"#).unwrap();
        assert!(matches!(null, Expression::Value { value: Some(_) }));

        let document = uffda_codec::from_str("{ kind: \"value\" value: undefined }").unwrap();
        let undefined: Expression = uffda_codec::data::de::from_document(&document).unwrap();
        assert!(matches!(undefined, Expression::Value { value: None }));
    }

    #[test]
    // req:expressions-runtime-003 req:expressions-runtime-006
    fn decodes_existing_expression_and_initializer_discriminators() {
        let expression: Expression = serde_json::from_str(
            r#"{"kind":"object","keys":[
                {"kind":"objectComputedKey",
                 "keyExpression":{"kind":"value","value":"items"},
                 "expression":{"kind":"array","expressions":[
                    {"kind":"arrayElement","expression":{"kind":"number","value":42}},
                    {"kind":"arraySpread","expression":{"kind":"value","value":[true,null]}}
                 ]}},
                {"kind":"objectSpread","expression":{"kind":"value","value":{}}}
            ]}"#,
        )
        .unwrap();
        let Expression::Object { keys } = expression else {
            panic!("expected object");
        };
        assert_eq!(keys.len(), 2);
        assert!(matches!(
            keys[0],
            ObjectInitializer::ObjectComputedKey { .. }
        ));
        assert!(matches!(keys[1], ObjectInitializer::ObjectSpread { .. }));
    }

    #[test]
    // req:expressions-runtime-003
    fn malformed_and_unimplemented_forms_fail_decoding_explicitly() {
        for source in [
            r#"{"kind":"number","value":"42"}"#,
            r#"{"kind":"array","expressions":[{"kind":"number","value":42}]}"#,
            r#"{"kind":"invocation","expression":{"kind":"reference","name":"id"}}"#,
            r#"{"kind":"unknown"}"#,
            r#"{"kind":"reference"}"#,
            r#"{"kind":"string","values":[{"kind":"unknown"}]}"#,
        ] {
            assert!(
                serde_json::from_str::<Expression>(source).is_err(),
                "{source}"
            );
        }
    }

    #[test]
    // req:expressions-runtime-007
    fn decodes_lambda_and_invocation_spread_without_accepting_native_code() {
        let source = r#"{"kind":"invocation",
              "expression":{"kind":"lambda","pattern":{"kind":"any"},
                            "expression":{"kind":"number","value":42}},
              "args":[{"kind":"invocationSpread","expression":{"kind":"value","value":[1,2]}}]}"#;
        assert!(serde_json::from_str::<Expression>(source).is_ok());
        assert!(serde_json::from_str::<Expression>(r#"{"kind":"native","fn":"code"}"#).is_err());
    }

    #[test]
    // req:expressions-runtime-004 req:expressions-runtime-007
    fn decodes_string_segments_and_unary_not() {
        let expression: Expression = serde_json::from_str(
                r#"{"kind":"string","values":["prefix",{"kind":"not","expression":{"kind":"boolean","value":true}}]}"#,
            ).unwrap();
        let Expression::String { values } = expression else {
            panic!("expected string");
        };
        assert_eq!(values.len(), 2);
        assert!(matches!(values[0], StringSegment::Literal(_)));
        assert!(matches!(
            values[1],
            StringSegment::Expression(Expression::Not { .. })
        ));
    }

    #[test]
    // req:expressions-runtime-003 req:data-codec-007
    fn codec_ast_literals_keep_native_values_without_json_materialization() {
        let document = crate::codec::data::DataDocument::from_codec(
            r#"{kind:"value" value:[undefined NaN 9007199254740993n @symbol"key"]}"#,
        )
        .unwrap();
        let expression: Expression = uffda_codec::data::de::from_document(&document).unwrap();
        let Expression::Value { value: Some(value) } = expression else {
            panic!("expected a value expression");
        };
        assert_eq!(
            value
                .encode(false, crate::codec::data::DataLimits::default())
                .unwrap(),
            r#"[undefined NaN 9007199254740993n @symbol"key"]"#
        );
    }
}

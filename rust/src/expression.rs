use crate::pattern::Pattern;
use crate::{json::JsonValue, text::RuntimeString};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Expression {
    Number {
        value: f64,
    },
    Boolean {
        value: bool,
    },
    Value {
        #[serde(default, deserialize_with = "deserialize_literal")]
        value: Option<JsonValue>,
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

fn deserialize_literal<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<JsonValue>, D::Error> {
    JsonValue::deserialize(deserializer).map(Some)
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum InvocationArgument {
    Spread(InvocationSpread),
    Expression(Expression),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InvocationSpread {
    InvocationSpread { expression: Expression },
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum StringSegment {
    Literal(RuntimeString),
    Expression(Expression),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ArrayInitializer {
    ArrayElement { expression: Expression },
    ArraySpread { expression: Expression },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ObjectInitializer {
    ObjectKey {
        name: RuntimeString,
        expression: Expression,
    },
    ObjectComputedKey {
        #[serde(rename = "keyExpression")]
        key_expression: Expression,
        expression: Expression,
    },
    ObjectSpread {
        expression: Expression,
    },
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
        assert!(matches!(
            null,
            Expression::Value {
                value: Some(JsonValue::Null)
            }
        ));
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
}

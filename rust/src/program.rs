use crate::expression::{
    ArrayInitializer, Expression, InvocationArgument, InvocationSpread, ObjectInitializer,
    StringSegment,
};
use crate::pattern::PatternProgram;
use crate::{json::JsonValue, text::RuntimeString};
use std::rc::Rc;

pub(crate) struct Program {
    pub nodes: Vec<Node>,
}

pub(crate) enum Node {
    Undefined,
    Number(f64),
    Boolean(bool),
    Value(JsonValue),
    Reference(String),
    Member(RuntimeString, usize),
    Array(Vec<(usize, bool)>),
    Object(Vec<Key>),
    String(Vec<usize>),
    Not(usize),
    Invocation(usize, Vec<(usize, bool)>),
    Lambda(Rc<PatternProgram>, usize),
}

pub(crate) enum Key {
    Named(RuntimeString, usize),
    Computed(usize, usize),
    Spread(usize),
}

impl Program {
    // Flat shared syntax permits repeated closure calls without recursively
    // cloning or dropping a deeply nested expression tree.
    pub fn compile(expression: Expression) -> Rc<Self> {
        let mut nodes = Vec::new();
        let mut pending = vec![(0, expression)];
        nodes.push(Node::Boolean(false));
        while let Some((index, expression)) = pending.pop() {
            let mut child = |expression| {
                let index = nodes.len();
                nodes.push(Node::Boolean(false));
                pending.push((index, expression));
                index
            };
            let node = match expression {
                Expression::Number { value } => Node::Number(value),
                Expression::Boolean { value } => Node::Boolean(value),
                Expression::Value { value: None } => Node::Undefined,
                Expression::Value { value: Some(value) } => match value {
                    JsonValue::Array(values) => Node::Array(
                        values
                            .into_iter()
                            .map(|value| (child(Expression::Value { value: Some(value) }), false))
                            .collect(),
                    ),
                    JsonValue::Object(values) => Node::Object(
                        values
                            .into_iter()
                            .map(|(name, value)| {
                                Key::Named(name, child(Expression::Value { value: Some(value) }))
                            })
                            .collect(),
                    ),
                    value => Node::Value(value),
                },
                Expression::Reference { name } => Node::Reference(name),
                Expression::Member { name, expression } => Node::Member(name, child(*expression)),
                Expression::Not { expression } => Node::Not(child(*expression)),
                Expression::Array { expressions } => Node::Array(
                    expressions
                        .into_iter()
                        .map(|entry| match entry {
                            ArrayInitializer::ArrayElement { expression } => {
                                (child(expression), false)
                            }
                            ArrayInitializer::ArraySpread { expression } => {
                                (child(expression), true)
                            }
                        })
                        .collect(),
                ),
                Expression::Object { keys } => Node::Object(
                    keys.into_iter()
                        .map(|key| match key {
                            ObjectInitializer::ObjectKey { name, expression } => {
                                Key::Named(name, child(expression))
                            }
                            ObjectInitializer::ObjectComputedKey {
                                key_expression,
                                expression,
                            } => Key::Computed(child(key_expression), child(expression)),
                            ObjectInitializer::ObjectSpread { expression } => {
                                Key::Spread(child(expression))
                            }
                        })
                        .collect(),
                ),
                Expression::String { values } => Node::String(
                    values
                        .into_iter()
                        .map(|value| {
                            child(match value {
                                StringSegment::Expression(expression) => expression,
                                StringSegment::Literal(value) => Expression::Value {
                                    value: Some(JsonValue::String(value)),
                                },
                            })
                        })
                        .collect(),
                ),
                Expression::Invocation { expression, args } => Node::Invocation(
                    child(*expression),
                    args.into_iter()
                        .map(|arg| match arg {
                            InvocationArgument::Expression(expression) => {
                                (child(expression), false)
                            }
                            InvocationArgument::Spread(InvocationSpread::InvocationSpread {
                                expression,
                            }) => (child(expression), true),
                        })
                        .collect(),
                ),
                Expression::Lambda {
                    pattern,
                    expression,
                } => Node::Lambda(PatternProgram::compile(pattern), child(*expression)),
            };
            nodes[index] = node;
        }
        Rc::new(Self { nodes })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pattern::Pattern;

    #[test]
    // req:runtime-strings-002
    fn compiled_segments_and_literal_object_keys_remain_lossless() {
        let ast = crate::json::from_str(r#"{"kind":"value","value":{"\ud800":"\udfff"}}"#).unwrap();
        let program = Program::compile(ast);
        let Node::Object(keys) = &program.nodes[0] else {
            panic!()
        };
        let Key::Named(name, child) = &keys[0] else {
            panic!()
        };
        assert_eq!(name.as_utf16(), &[0xd800]);
        let Node::Value(JsonValue::String(value)) = &program.nodes[*child] else {
            panic!()
        };
        assert_eq!(value.as_utf16(), &[0xdfff]);
    }

    #[test]
    // req:expressions-runtime-003
    fn absent_value_literal_has_a_distinct_compiled_node_from_null() {
        let undefined = Program::compile(Expression::Value { value: None });
        assert!(matches!(undefined.nodes[0], Node::Undefined));
        let null = Program::compile(Expression::Value {
            value: Some(JsonValue::Null),
        });
        assert!(matches!(null.nodes[0], Node::Value(JsonValue::Null)));
    }

    #[test]
    // req:runtime-memory-005 req:expressions-runtime-007
    fn deep_lambda_bodies_are_compiled_and_dropped_without_recursing() {
        let mut expression = Expression::Number { value: 42.0 };
        for _ in 0..20_000 {
            expression = Expression::Not {
                expression: Box::new(expression),
            };
        }
        let program = Program::compile(Expression::Lambda {
            pattern: Pattern::Any,
            expression: Box::new(expression),
        });
        assert_eq!(program.nodes.len(), 20_002);
    }
}

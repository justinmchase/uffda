use crate::expression::{
    ArrayInitializer, Expression, InvocationArgument, InvocationSpread, ObjectInitializer,
    StringSegment,
};
use crate::pattern::PatternProgram;
use std::rc::Rc;

pub(crate) struct Program {
    pub nodes: Vec<Node>,
}

pub(crate) enum Node {
    Number(f64),
    Boolean(bool),
    Value(serde_json::Value),
    Reference(String),
    Member(String, usize),
    Array(Vec<(usize, bool)>),
    Object(Vec<Key>),
    String(Vec<usize>),
    Not(usize),
    Invocation(usize, Vec<(usize, bool)>),
    Lambda(Rc<PatternProgram>, usize),
}

pub(crate) enum Key {
    Named(String, usize),
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
                Expression::Value { value } => match value {
                    serde_json::Value::Array(values) => Node::Array(
                        values
                            .into_iter()
                            .map(|value| (child(Expression::Value { value }), false))
                            .collect(),
                    ),
                    serde_json::Value::Object(values) => Node::Object(
                        values
                            .into_iter()
                            .map(|(name, value)| {
                                Key::Named(name, child(Expression::Value { value }))
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
                                    value: serde_json::Value::String(value),
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

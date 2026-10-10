use crate::coercion::{StringCoercionError, number_text, truthy};
use crate::environment::Environment;
use crate::expression::Expression;
use crate::pattern::{MatchKind, PatternError, PatternExecution};
use crate::program::{Key, Node, Program};
use crate::provenance::{Origin, concatenate};
use crate::value::{Closure, Value};
use gc_arena::{Arena, Collect, DynamicRoot, DynamicRootSet, Gc, Mutation, Rootable};
use std::fmt;
use std::rc::Rc;

#[derive(Clone)]
pub struct RootedValue(DynamicRoot<Rootable![Value<'_>]>);

impl fmt::Debug for RootedValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RootedValue").finish_non_exhaustive()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EvaluationError {
    UnknownReference(String),
    NotIterable,
    InvalidPropertyKey,
    NullishMember(String),
    UnsupportedMember,
    ForeignRoot,
    InvalidState,
    StringCoercion(StringCoercionError),
    NotCallable,
    LambdaArguments,
    Pattern(PatternError),
}

impl fmt::Display for EvaluationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownReference(name) => write!(f, "unknown reference: {name}"),
            Self::NotIterable => write!(f, "array spread value is not iterable"),
            Self::InvalidPropertyKey => write!(f, "object computed key must be a string or number"),
            Self::NullishMember(name) => {
                write!(f, "cannot read property {name} of null or undefined")
            }
            Self::UnsupportedMember => write!(f, "member access for this value is not implemented"),
            Self::ForeignRoot => write!(f, "value belongs to another runtime"),
            Self::InvalidState => write!(f, "invalid expression evaluation stack"),
            Self::StringCoercion(error) => error.fmt(f),
            Self::NotCallable => write!(f, "Unable to invoke function: target is not callable"),
            Self::LambdaArguments => write!(f, "lambda: arguments did not match parameter pattern"),
            Self::Pattern(error) => write!(f, "lambda: {error}"),
        }
    }
}

impl std::error::Error for EvaluationError {}

#[derive(Collect)]
#[collect(no_drop)]
struct State<'gc> {
    environment: Environment<'gc>,
    origin: Origin,
    matched_value: Value<'gc>,
    #[collect(require_static)]
    program: Rc<Program>,
    frames: Vec<Frame<'gc>>,
    values: Vec<Value<'gc>>,
    external: DynamicRootSet<'gc>,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Frame<'gc> {
    Evaluate(usize),
    Literal(#[collect(require_static)] serde_json::Value),
    Array(Vec<bool>),
    Object(#[collect(require_static)] Vec<ObjectKey>),
    Member(String),
    String(usize),
    Not,
    Invoke(Vec<bool>),
    Parameters {
        execution: PatternExecution<'gc>,
        closure: Gc<'gc, Closure<'gc>>,
    },
    Restore {
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
        #[collect(require_static)]
        program: Rc<Program>,
    },
}

enum ObjectKey {
    Named(String),
    Computed,
    Spread,
}

pub struct Evaluation {
    arena: Arena<Rootable![State<'_>]>,
    error: Option<EvaluationError>,
    result: Option<RootedValue>,
}

impl Evaluation {
    pub fn new(expression: Expression) -> Self {
        Self::with_environment(expression, |mc| Environment::new(mc, None, vec![]))
    }

    pub fn with_environment(
        expression: Expression,
        build: impl for<'gc> FnOnce(&Mutation<'gc>) -> Environment<'gc>,
    ) -> Self {
        let program = Program::compile(expression);
        Self {
            arena: Arena::new(|mc| State {
                environment: build(mc),
                origin: Origin { start: 0, end: 0 },
                matched_value: Value::Undefined,
                program,
                frames: vec![Frame::Evaluate(0)],
                values: vec![],
                external: DynamicRootSet::new(mc),
            }),
            error: None,
            result: None,
        }
    }

    /// Executes one frame, then permits collection before the next frame.
    pub fn step(&mut self) -> Result<bool, EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome: Result<bool, EvaluationError> = self.arena.mutate_root(|mc, state| {
            if let Some(frame) = state.frames.pop() {
                execute(frame, mc, state)?;
            }
            Ok(state.frames.is_empty())
        });
        if let Err(error) = &outcome {
            self.error = Some(error.clone());
            self.arena.mutate_root(|_, state| {
                while let Some(frame) = state.frames.pop() {
                    if let Frame::Restore {
                        environment,
                        program,
                        origin,
                        matched_value,
                    } = frame
                    {
                        state.environment = environment;
                        state.program = program;
                        state.origin = origin;
                        state.matched_value = matched_value;
                    }
                }
                state.values.clear();
            });
        }
        self.arena.collect_debt();
        outcome
    }

    pub fn collect(&mut self) {
        self.arena.finish_cycle();
    }

    pub fn finish(&mut self) -> Result<RootedValue, EvaluationError> {
        while !self.step()? {}
        if let Some(result) = &self.result {
            return Ok(result.clone());
        }
        let result = self.arena.mutate_root(|mc, state| {
            if state.values.len() != 1 {
                return Err(EvaluationError::InvalidState);
            }
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            Ok(RootedValue(
                state
                    .external
                    .stash::<Rootable![Value<'_>]>(mc, Gc::new(mc, value)),
            ))
        })?;
        self.result = Some(result.clone());
        Ok(result)
    }

    pub fn read<T>(
        &self,
        value: &RootedValue,
        read: impl for<'gc> FnOnce(Value<'gc>) -> T,
    ) -> Result<T, EvaluationError> {
        self.read_with_provenance(value, |value| read(value.raw()))
    }

    pub fn read_with_provenance<T>(
        &self,
        value: &RootedValue,
        read: impl for<'gc> FnOnce(Value<'gc>) -> T,
    ) -> Result<T, EvaluationError> {
        self.arena.mutate(|_, state| {
            let value = state
                .external
                .try_fetch(&value.0)
                .map_err(|_| EvaluationError::ForeignRoot)?;
            Ok(read(*value))
        })
    }
}

fn execute<'gc>(
    frame: Frame<'gc>,
    mc: &Mutation<'gc>,
    state: &mut State<'gc>,
) -> Result<(), EvaluationError> {
    match frame {
        Frame::Evaluate(index) => match &state.program.nodes[index] {
            Node::Number(value) => state.values.push(Value::Number(*value)),
            Node::Boolean(value) => state.values.push(Value::Boolean(*value)),
            Node::Value(value) => state.frames.push(Frame::Literal(value.clone())),
            Node::Reference(name) if name == "_" => state.values.push(state.matched_value),
            Node::Reference(name) => state.values.push(
                state
                    .environment
                    .get(name)
                    .ok_or_else(|| EvaluationError::UnknownReference(name.clone()))?,
            ),
            Node::Member(name, expression) => {
                state.frames.push(Frame::Member(name.clone()));
                state.frames.push(Frame::Evaluate(*expression));
            }
            Node::Not(expression) => {
                state.frames.push(Frame::Not);
                state.frames.push(Frame::Evaluate(*expression));
            }
            Node::String(values) => {
                state.frames.push(Frame::String(values.len()));
                state
                    .frames
                    .extend(values.iter().rev().copied().map(Frame::Evaluate));
            }
            Node::Array(expressions) => {
                let kinds = expressions.iter().map(|(_, spread)| *spread).collect();
                state.frames.push(Frame::Array(kinds));
                for (expression, _) in expressions.iter().rev() {
                    state.frames.push(Frame::Evaluate(*expression));
                }
            }
            Node::Object(keys) => {
                let mut operations = Vec::with_capacity(keys.len());
                let mut children = Vec::new();
                for key in keys {
                    match key {
                        Key::Named(name, expression) => {
                            operations.push(ObjectKey::Named(name.clone()));
                            children.push(*expression);
                        }
                        Key::Computed(key_expression, expression) => {
                            operations.push(ObjectKey::Computed);
                            children.push(*key_expression);
                            children.push(*expression);
                        }
                        Key::Spread(expression) => {
                            operations.push(ObjectKey::Spread);
                            children.push(*expression);
                        }
                    }
                }
                state.frames.push(Frame::Object(operations));
                state
                    .frames
                    .extend(children.into_iter().rev().map(Frame::Evaluate));
            }
            Node::Lambda(pattern, body) => {
                state.values.push(Value::Lambda(Gc::new(
                    mc,
                    Closure {
                        environment: state.environment,
                        origin: state.origin,
                        program: state.program.clone(),
                        pattern: pattern.clone(),
                        body: *body,
                    },
                )));
            }
            Node::Invocation(expression, args) => {
                state.frames.push(Frame::Invoke(
                    args.iter().map(|(_, spread)| *spread).collect(),
                ));
                state
                    .frames
                    .extend(args.iter().rev().map(|(arg, _)| Frame::Evaluate(*arg)));
                state.frames.push(Frame::Evaluate(*expression));
            }
        },
        Frame::Literal(value) => match value {
            serde_json::Value::Null => state.values.push(Value::Null),
            serde_json::Value::Bool(value) => state.values.push(Value::Boolean(value)),
            serde_json::Value::Number(value) => state.values.push(Value::Number(
                value.as_f64().ok_or(EvaluationError::InvalidState)?,
            )),
            serde_json::Value::String(value) => state.values.push(Value::string(mc, value)),
            serde_json::Value::Array(values) => {
                state.frames.push(Frame::Array(vec![false; values.len()]));
                state
                    .frames
                    .extend(values.into_iter().rev().map(Frame::Literal));
            }
            serde_json::Value::Object(values) => {
                state.frames.push(Frame::Object(
                    values.keys().cloned().map(ObjectKey::Named).collect(),
                ));
                state
                    .frames
                    .extend(values.into_values().rev().map(Frame::Literal));
            }
        },
        Frame::Array(spreads) => {
            let values = take_values(&mut state.values, spreads.len())?;
            let mut result = Vec::new();
            for (value, spread) in values.into_iter().zip(spreads) {
                if !spread {
                    result.push(value);
                } else {
                    match value.raw() {
                        Value::Array(values) => result.extend(
                            values
                                .borrow()
                                .iter()
                                .enumerate()
                                .map(|(index, item)| value.carry_item(mc, *item, index)),
                        ),
                        Value::String(text) => {
                            result.extend(text.chars().enumerate().map(|(index, c)| {
                                let item = Value::string(mc, c.to_string());
                                value.carry_item(mc, item, index)
                            }))
                        }
                        _ => return Err(EvaluationError::NotIterable),
                    }
                }
            }
            state.values.push(Value::array(mc, result));
        }
        Frame::Object(keys) => {
            let count = keys
                .iter()
                .map(|key| {
                    if matches!(key, ObjectKey::Computed) {
                        2
                    } else {
                        1
                    }
                })
                .sum();
            let mut values = take_values(&mut state.values, count)?.into_iter();
            let mut result = Vec::new();
            for key in keys {
                let value = values.next().ok_or(EvaluationError::InvalidState)?;
                match key {
                    ObjectKey::Named(name) => result.push((name, value)),
                    ObjectKey::Computed => {
                        let name = match value.raw() {
                            Value::String(value) => (*value).clone(),
                            Value::Number(value) => number_text(value),
                            _ => return Err(EvaluationError::InvalidPropertyKey),
                        };
                        result.push((name, values.next().ok_or(EvaluationError::InvalidState)?));
                    }
                    ObjectKey::Spread => {
                        match value.raw() {
                            Value::Object(properties) => result.extend(
                                properties.borrow().entries().iter().map(|(name, item)| {
                                    (
                                        name.clone(),
                                        item.wrap(mc, value.origin().unwrap_or(state.origin)),
                                    )
                                }),
                            ),
                            Value::Array(values) => {
                                result.extend(values.borrow().iter().enumerate().map(
                                    |(i, item)| (i.to_string(), value.carry_item(mc, *item, i)),
                                ))
                            }
                            // Current object spreading ignores non-object primitives.
                            _ => {}
                        }
                    }
                }
            }
            state.values.push(Value::object(mc, result));
        }
        Frame::Member(name) => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            let property = match value.raw() {
                Value::Object(properties) => {
                    properties.borrow().get(&name).unwrap_or(Value::Undefined)
                }
                Value::Array(values) if name == "length" => {
                    Value::Number(values.borrow().len() as f64)
                }
                Value::Array(values) => match array_index(&name) {
                    Some(index) => values
                        .borrow()
                        .get(index)
                        .copied()
                        .unwrap_or(Value::Undefined),
                    None => return Err(EvaluationError::UnsupportedMember),
                },
                Value::Null | Value::Undefined => return Err(EvaluationError::NullishMember(name)),
                _ => return Err(EvaluationError::UnsupportedMember),
            };
            state
                .values
                .push(property.wrap(mc, value.origin().unwrap_or(state.origin)));
        }
        Frame::Not => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            state.values.push(Value::Boolean(!truthy(value)));
        }
        Frame::String(count) => {
            let values = take_values(&mut state.values, count)?;
            state.values.push(
                concatenate(mc, &values, state.origin).map_err(EvaluationError::StringCoercion)?,
            );
        }
        Frame::Invoke(spreads) => {
            let mut values = take_values(&mut state.values, spreads.len() + 1)?.into_iter();
            let callee = values.next().ok_or(EvaluationError::InvalidState)?;
            let mut args = Vec::new();
            for (value, spread) in values.zip(spreads) {
                if spread {
                    match value.raw() {
                        Value::Array(values) => args.extend(
                            values
                                .borrow()
                                .iter()
                                .enumerate()
                                .map(|(index, item)| value.carry_item(mc, *item, index)),
                        ),
                        Value::String(text) => {
                            args.extend(text.chars().enumerate().map(|(index, c)| {
                                value.carry_item(mc, Value::string(mc, c.to_string()), index)
                            }))
                        }
                        _ => return Err(EvaluationError::NotIterable),
                    }
                } else {
                    args.push(value);
                }
            }
            let Value::Lambda(closure) = callee.raw() else {
                return Err(EvaluationError::NotCallable);
            };
            state.frames.push(Frame::Parameters {
                execution: PatternExecution::compiled(
                    mc,
                    closure.pattern.clone(),
                    args,
                    closure.environment,
                    closure.origin.start,
                ),
                closure,
            });
        }
        Frame::Parameters {
            mut execution,
            closure,
        } => {
            if !execution.step(mc).map_err(EvaluationError::Pattern)? {
                state.frames.push(Frame::Parameters { execution, closure });
            } else {
                let matched = execution.result().ok_or(EvaluationError::InvalidState)?;
                if matched.kind == MatchKind::Fail {
                    return Err(EvaluationError::LambdaArguments);
                }
                state.frames.push(Frame::Restore {
                    environment: state.environment,
                    program: state.program.clone(),
                    origin: state.origin,
                    matched_value: state.matched_value,
                });
                state.environment = matched.environment;
                state.origin = matched.origin;
                state.matched_value = matched.value;
                state.program = closure.program.clone();
                state.frames.push(Frame::Evaluate(closure.body));
            }
        }
        Frame::Restore {
            environment,
            program,
            origin,
            matched_value,
        } => {
            state.environment = environment;
            state.program = program;
            state.origin = origin;
            state.matched_value = matched_value;
        }
    }
    if let Some(value) = state.values.last_mut() {
        *value = value.wrap(mc, state.origin);
    }
    Ok(())
}

fn take_values<'gc>(
    values: &mut Vec<Value<'gc>>,
    count: usize,
) -> Result<Vec<Value<'gc>>, EvaluationError> {
    let start = values
        .len()
        .checked_sub(count)
        .ok_or(EvaluationError::InvalidState)?;
    Ok(values.split_off(start))
}

fn array_index(name: &str) -> Option<usize> {
    let index = name.parse::<u32>().ok()?;
    (index != u32::MAX && index.to_string() == name).then_some(index as usize)
}

#[cfg(test)]
mod tests;

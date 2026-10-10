use crate::environment::Environment;
use crate::provenance::Origin;
use crate::value::{RuntimeType, Value};
use gc_arena::{Collect, Gc, Mutation};
use serde::Deserialize;
use std::rc::Rc;

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Pattern {
    Any,
    Ok,
    Fail,
    End,
    Equal {
        value: ValueSource,
    },
    Includes {
        values: Vec<ValueSource>,
    },
    Between {
        left: Option<ValueSource>,
        right: Option<ValueSource>,
    },
    Then {
        patterns: Vec<Self>,
    },
    Or {
        patterns: Vec<Self>,
    },
    Variable {
        name: String,
        pattern: Box<Self>,
    },
    Maybe {
        pattern: Box<Self>,
    },
    Not {
        pattern: Box<Self>,
    },
    Lookahead {
        pattern: Box<Self>,
    },
    Skip {
        pattern: Box<Self>,
    },
    Into {
        pattern: Box<Self>,
    },
    Except {
        pattern: Box<Self>,
    },
    Type {
        #[serde(rename = "type")]
        expected: RuntimeType,
    },
    Quantifier {
        pattern: Box<Self>,
        min: Option<ValueSource>,
        max: Option<ValueSource>,
    },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind")]
pub enum ValueSource {
    #[serde(rename = "value.literal")]
    Literal { value: serde_json::Value },
    #[serde(rename = "value.variable")]
    Variable { name: String },
}

pub(crate) struct PatternProgram {
    nodes: Vec<PatternNode>,
}

enum PatternNode {
    Any,
    Ok,
    Fail,
    End,
    Equal(ValueSource),
    Includes(Vec<ValueSource>),
    Between(Option<ValueSource>, Option<ValueSource>),
    Then(Vec<usize>),
    Or(Vec<usize>),
    Variable(String, usize),
    Unary(Unary, usize),
    Type(RuntimeType),
    Quantifier(usize, Option<ValueSource>, Option<ValueSource>),
}

#[derive(Clone, Copy, Collect)]
#[collect(require_static)]
enum Unary {
    Maybe,
    Not,
    Lookahead,
    Skip,
    Into,
    Except,
}

impl PatternProgram {
    pub(crate) fn compile(pattern: Pattern) -> Rc<Self> {
        let mut nodes = vec![PatternNode::Fail];
        let mut pending = vec![(0, pattern)];
        while let Some((index, pattern)) = pending.pop() {
            let mut child = |pattern| {
                let index = nodes.len();
                nodes.push(PatternNode::Fail);
                pending.push((index, pattern));
                index
            };
            let node = match pattern {
                Pattern::Any => PatternNode::Any,
                Pattern::Ok => PatternNode::Ok,
                Pattern::Fail => PatternNode::Fail,
                Pattern::End => PatternNode::End,
                Pattern::Equal { value } => PatternNode::Equal(value),
                Pattern::Includes { values } => PatternNode::Includes(values),
                Pattern::Between { left, right } => PatternNode::Between(left, right),
                Pattern::Then { patterns } => {
                    PatternNode::Then(patterns.into_iter().map(&mut child).collect())
                }
                Pattern::Or { patterns } => {
                    PatternNode::Or(patterns.into_iter().map(&mut child).collect())
                }
                Pattern::Variable { name, pattern } => PatternNode::Variable(name, child(*pattern)),
                Pattern::Maybe { pattern } => PatternNode::Unary(Unary::Maybe, child(*pattern)),
                Pattern::Not { pattern } => PatternNode::Unary(Unary::Not, child(*pattern)),
                Pattern::Lookahead { pattern } => {
                    PatternNode::Unary(Unary::Lookahead, child(*pattern))
                }
                Pattern::Skip { pattern } => PatternNode::Unary(Unary::Skip, child(*pattern)),
                Pattern::Into { pattern } => PatternNode::Unary(Unary::Into, child(*pattern)),
                Pattern::Except { pattern } => PatternNode::Unary(Unary::Except, child(*pattern)),
                Pattern::Type { expected } => PatternNode::Type(expected),
                Pattern::Quantifier { pattern, min, max } => {
                    PatternNode::Quantifier(child(*pattern), min, max)
                }
            };
            nodes[index] = node;
        }
        Rc::new(Self { nodes })
    }
}

impl Drop for PatternProgram {
    fn drop(&mut self) {
        let mut pending = Vec::new();
        let mut take = |source: &mut ValueSource| {
            if let ValueSource::Literal { value } = source {
                pending.push(std::mem::take(value));
            }
        };
        for node in &mut self.nodes {
            match node {
                PatternNode::Equal(source) => take(source),
                PatternNode::Includes(sources) => sources.iter_mut().for_each(&mut take),
                PatternNode::Quantifier(_, min, max) | PatternNode::Between(min, max) => {
                    if let Some(source) = min {
                        take(source);
                    }
                    if let Some(source) = max {
                        take(source);
                    }
                }
                _ => {}
            }
        }
        while let Some(value) = pending.pop() {
            match value {
                serde_json::Value::Array(values) => pending.extend(values),
                serde_json::Value::Object(values) => pending.extend(values.into_values()),
                _ => {}
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PatternError {
    UnknownValueReference(String),
    DuplicateVariable(String),
    IterableExpected,
    InvalidState,
    InvalidBound(String),
    NullValue,
}

impl std::fmt::Display for PatternError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownValueReference(name) => write!(f, "Unknown value reference ${name}"),
            Self::DuplicateVariable(name) => write!(f, "Variable {name} already exists in scope"),
            Self::IterableExpected => write!(f, "expected value to be iterable"),
            Self::InvalidState => write!(f, "invalid pattern execution state"),
            Self::InvalidBound(message) => message.fmt(f),
            Self::NullValue => write!(f, "expected value to be non-null"),
        }
    }
}

impl std::error::Error for PatternError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub enum MatchKind {
    Ok,
    Skip,
    Fail,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
struct Scope<'gc> {
    input: Gc<'gc, Vec<Value<'gc>>>,
    position: usize,
    environment: Environment<'gc>,
    base: usize,
    open: bool,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct PatternMatch<'gc> {
    pub kind: MatchKind,
    pub value: Value<'gc>,
    pub start: usize,
    pub end: usize,
    pub environment: Environment<'gc>,
    pub origin: Origin,
    pub children: Vec<Gc<'gc, PatternMatch<'gc>>>,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Frame<'gc> {
    Match(usize, Scope<'gc>),
    Variable(String, Scope<'gc>),
    Unary(Unary, Scope<'gc>),
    Sequence {
        #[collect(require_static)]
        nodes: Vec<usize>,
        index: usize,
        start: Scope<'gc>,
        current: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
        values: Vec<Value<'gc>>,
    },
    Choice {
        #[collect(require_static)]
        nodes: Vec<usize>,
        index: usize,
        start: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    },
    Repeat {
        node: usize,
        min: f64,
        max: f64,
        count: usize,
        start: Scope<'gc>,
        current: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
        values: Vec<Value<'gc>>,
    },
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct PatternExecution<'gc> {
    #[collect(require_static)]
    program: Rc<PatternProgram>,
    frames: Vec<Frame<'gc>>,
    result: Option<Gc<'gc, PatternMatch<'gc>>>,
    #[collect(require_static)]
    error: Option<PatternError>,
}

impl<'gc> PatternExecution<'gc> {
    pub fn new(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
    ) -> Self {
        Self::compiled(mc, PatternProgram::compile(pattern), input, environment, 0)
    }

    pub fn new_open(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
    ) -> Self {
        let mut execution = Self::new(mc, pattern, input, environment);
        if let Some(Frame::Match(_, scope)) = execution.frames.last_mut() {
            scope.open = true;
        }
        execution
    }

    pub(crate) fn compiled(
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        base: usize,
    ) -> Self {
        let scope = Scope {
            input: Gc::new(
                mc,
                input
                    .into_iter()
                    .enumerate()
                    .map(|(index, value)| {
                        value.wrap(
                            mc,
                            Origin {
                                start: index,
                                end: index + 1,
                            },
                        )
                    })
                    .collect(),
            ),
            position: 0,
            environment,
            base,
            open: false,
        };
        Self {
            program,
            frames: vec![Frame::Match(0, scope)],
            result: None,
            error: None,
        }
    }

    pub fn result(&self) -> Option<Gc<'gc, PatternMatch<'gc>>> {
        if self.frames.is_empty() {
            self.result
        } else {
            None
        }
    }

    pub fn step(&mut self, mc: &Mutation<'gc>) -> Result<bool, PatternError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let result = self.execute(mc);
        if let Err(error) = &result {
            self.error = Some(error.clone());
            self.frames.clear();
            self.result = None;
        }
        result
    }

    fn execute(&mut self, mc: &Mutation<'gc>) -> Result<bool, PatternError> {
        let Some(frame) = self.frames.pop() else {
            return Ok(true);
        };
        match frame {
            Frame::Match(index, scope) => match &self.program.nodes[index] {
                PatternNode::Any => self.set(
                    mc,
                    scope,
                    scope.position < scope.input.len(),
                    true,
                    scope
                        .input
                        .get(scope.position)
                        .copied()
                        .unwrap_or(Value::Undefined),
                    vec![],
                ),
                PatternNode::Ok => self.set(mc, scope, true, false, Value::Undefined, vec![]),
                PatternNode::Fail => self.set(mc, scope, false, false, Value::Undefined, vec![]),
                PatternNode::End => self.set(
                    mc,
                    scope,
                    scope.position == scope.input.len(),
                    false,
                    Value::Undefined,
                    vec![],
                ),
                PatternNode::Equal(source) => {
                    let matches = equal(source, scope, false)?;
                    self.set(
                        mc,
                        scope,
                        matches,
                        true,
                        scope
                            .input
                            .get(scope.position)
                            .copied()
                            .unwrap_or(Value::Undefined),
                        vec![],
                    );
                }
                PatternNode::Includes(sources) => {
                    let mut matches = false;
                    for source in sources {
                        // Resolve every operand before testing input; a later
                        // invalid source is an error even if an earlier one matches.
                        matches |= equal(source, scope, true)?;
                    }
                    self.set(
                        mc,
                        scope,
                        matches,
                        true,
                        scope
                            .input
                            .get(scope.position)
                            .copied()
                            .unwrap_or(Value::Undefined),
                        vec![],
                    );
                }
                PatternNode::Variable(name, child) => {
                    if scope.environment.get(name).is_some() {
                        return Err(PatternError::DuplicateVariable(name.clone()));
                    }
                    PatternNode::Between(left, right) => {
                        if left.is_none() && right.is_none() {
                            return Err(PatternError::InvalidBound(
                                "between requires at least one bound (L..R, L.., or ..R)".into(),
                            ));
                        }
                        let left = left.as_ref().map(|source| source_value(mc, source, scope)).transpose()?;
                        let right = right.as_ref().map(|source| source_value(mc, source, scope)).transpose()?;
                        let value = scope.input.get(scope.position).copied();
                        let matched = match value {
                            Some(value) => {
                                if matches!(value.raw(), Value::Null | Value::Undefined) {
                                    return Err(PatternError::NullValue);
                                }
                                left.is_none_or(|left| ordered_le(left, value)) &&
                                    right.is_none_or(|right| ordered_le(value, right))
                            }
                            None => false,
                        };
                        self.set(mc, scope, matched, true, value.unwrap_or(Value::Undefined), vec![]);
                    }
                    self.frames.push(Frame::Variable(name.clone(), scope));
                    self.frames.push(Frame::Match(*child, scope));
                }
                PatternNode::Unary(unary, child) => {
                    let mut inner = scope;
                    if matches!(unary, Unary::Except) && scope.position == scope.input.len() {
                        self.set(mc, scope, false, false, Value::Undefined, vec![]);
                        return Ok(self.frames.is_empty());
                    }
                    if matches!(unary, Unary::Into) {
                        let Some(value) = scope.input.get(scope.position).copied() else {
                            self.set(mc, scope, false, false, Value::Undefined, vec![]);
                            return Ok(self.frames.is_empty());
                        };
                        let input = match value.raw() {
                            Value::Array(values) => values
                                .borrow()
                                .iter()
                                .enumerate()
                                .map(|(index, item)| value.carry_item(mc, *item, index))
                                .collect(),
                            Value::String(value) => value
                                .chars()
                                .map(|c| Value::string(mc, c.to_string()))
                                .enumerate()
                                .map(|(index, item)| {
                                    scope.input[scope.position].carry_item(mc, item, index)
                                })
                                .collect(),
                            _ => return Err(PatternError::IterableExpected),
                        };
                        inner.input = Gc::new(mc, input);
                        inner.position = 0;
                        inner.base = value.origin().map_or(scope.base, |origin| origin.start);
                        inner.open = scope.open && scope.position + 1 == scope.input.len();
                    }
                    self.frames.push(Frame::Unary(*unary, scope));
                    self.frames.push(Frame::Match(*child, inner));
                }
                PatternNode::Then(nodes) => {
                    if let Some(first) = nodes.first() {
                        self.frames.push(Frame::Sequence {
                            nodes: nodes.clone(),
                            index: 0,
                            start: scope,
                            current: scope,
                            children: vec![],
                            values: vec![],
                        });
                        self.frames.push(Frame::Match(*first, scope));
                    } else {
                        self.set(mc, scope, true, false, Value::array(mc, vec![]), vec![]);
                    }
                }
                PatternNode::Or(nodes) => {
                    if let Some(first) = nodes.first() {
                        self.frames.push(Frame::Choice {
                            nodes: nodes.clone(),
                            index: 0,
                            start: scope,
                            children: vec![],
                        });
                        self.frames.push(Frame::Match(*first, scope));
                    } else {
                        self.set(mc, scope, false, false, Value::Undefined, vec![]);
                    }
                }
                PatternNode::Type(expected) => {
                    let value = scope.input.get(scope.position).copied();
                    self.set(
                        mc,
                        scope,
                        value.is_some_and(|value| value.runtime_type() == *expected),
                        true,
                        value.unwrap_or(Value::Undefined),
                        vec![],
                    );
                }
                PatternNode::Quantifier(node, min, max) => {
                    let min = bound(min.as_ref(), scope, "min", 0.0)?;
                    let max = bound(max.as_ref(), scope, "max", f64::INFINITY)?;
                    if max < min {
                        return Err(PatternError::InvalidBound(format!(
                            "max must be greater than or equal to min but is {max} < {min}"
                        )));
                    }
                    if max == 0.0 || (!scope.open && scope.position == scope.input.len()) {
                        self.repeat_result(mc, scope, scope, 0, min, vec![], vec![]);
                    } else {
                        self.frames.push(Frame::Repeat {
                            node: *node,
                            min,
                            max,
                            count: 0,
                            start: scope,
                            current: scope,
                            children: vec![],
                            values: vec![],
                        });
                        self.frames.push(Frame::Match(*node, scope));
                    }
                }
            },
            Frame::Variable(name, start) => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                let environment = if child.kind == MatchKind::Fail {
                    start.environment
                } else {
                    Environment::new(mc, Some(child.environment), vec![(name, child.value)])
                };
                self.result = Some(Gc::new(
                    mc,
                    PatternMatch {
                        kind: child.kind,
                        value: child.value,
                        start: start.position,
                        end: child.end,
                        environment,
                        origin: span(start, child.end),
                        children: vec![child],
                    },
                ));
            }
            Frame::Unary(unary, start) => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                let matched = child.kind != MatchKind::Fail;
                let mut result = PatternMatch {
                    kind: child.kind,
                    value: child.value,
                    start: start.position,
                    end: child.end,
                    environment: child.environment,
                    origin: span(start, start.position),
                    children: vec![child],
                };
                match unary {
                    Unary::Maybe if !matched => {
                        result.kind = MatchKind::Ok;
                        result.value = Value::Undefined;
                        result.end = start.position;
                        result.environment = start.environment;
                    }
                    Unary::Not => {
                        result.kind = if matched {
                            MatchKind::Fail
                        } else {
                            MatchKind::Ok
                        };
                        result.value = Value::Undefined;
                        result.end = start.position;
                        result.environment = start.environment;
                    }
                    Unary::Lookahead => {
                        result.kind = if matched {
                            MatchKind::Ok
                        } else {
                            MatchKind::Fail
                        };
                        result.end = start.position;
                        result.environment = start.environment;
                    }
                    Unary::Skip if matched => {
                        result.kind = MatchKind::Skip;
                        result.value = Value::Undefined;
                    }
                    Unary::Into => {
                        // The child scope's stream is nested; full consumption is
                        // checked against the stream retained in its invocation frame.
                        let consumed = child.end;
                        let length = match start.input[start.position].raw() {
                            Value::Array(values) => values.borrow().len(),
                            Value::String(value) => value.chars().count(),
                            _ => return Err(PatternError::IterableExpected),
                        };
                        if !matched || consumed != length {
                            result.kind = MatchKind::Fail;
                            result.value = Value::Undefined;
                            result.end = start.position;
                            result.environment = start.environment;
                        } else {
                            result.end = start.position + 1;
                        }
                        result.origin = span(start, result.end);
                        if result.kind != MatchKind::Fail {
                            result.value = result.value.wrap(mc, result.origin);
                        }
                    }
                    Unary::Except => {
                        result.kind = if matched {
                            MatchKind::Fail
                        } else {
                            MatchKind::Ok
                        };
                        result.end = start.position + usize::from(!matched);
                        result.environment = start.environment;
                        result.value = if matched {
                            Value::Undefined
                        } else {
                            start.input[start.position]
                        };
                    }
                    _ => {}
                }
                self.result = Some(Gc::new(mc, result));
            }
            Frame::Sequence {
                nodes,
                index,
                start,
                mut current,
                mut children,
                mut values,
            } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                children.push(child);
                if child.kind == MatchKind::Fail {
                    self.set(mc, start, false, false, Value::Undefined, children);
                } else {
                    current.position = child.end;
                    current.environment = child.environment;
                    if child.kind == MatchKind::Ok {
                        values.push(child.value);
                    }
                    if let Some(next) = nodes.get(index + 1).copied() {
                        self.frames.push(Frame::Sequence {
                            nodes,
                            index: index + 1,
                            start,
                            current,
                            children,
                            values,
                        });
                        self.frames.push(Frame::Match(next, current));
                    } else {
                        self.result = Some(Gc::new(
                            mc,
                            PatternMatch {
                                kind: MatchKind::Ok,
                                value: Value::array(mc, values)
                                    .wrap(mc, span(start, current.position)),
                                start: start.position,
                                end: current.position,
                                environment: current.environment,
                                origin: span(start, current.position),
                                children,
                            },
                        ));
                    }
                }
            }
            Frame::Choice {
                nodes,
                index,
                start,
                mut children,
            } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                children.push(child);
                if child.kind != MatchKind::Fail {
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            kind: child.kind,
                            value: child.value,
                            start: start.position,
                            end: child.end,
                            environment: child.environment,
                            origin: span(start, child.end),
                            children,
                        },
                    ));
                } else if let Some(next) = nodes.get(index + 1).copied() {
                    self.frames.push(Frame::Choice {
                        nodes,
                        index: index + 1,
                        start,
                        children,
                    });
                    self.frames.push(Frame::Match(next, start));
                } else {
                    self.set(mc, start, false, false, Value::Undefined, children);
                }
            }
            Frame::Repeat {
                node,
                min,
                max,
                mut count,
                start,
                mut current,
                mut children,
                mut values,
            } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                children.push(child);
                if child.kind == MatchKind::Fail {
                    self.repeat_result(mc, start, current, count, min, children, values);
                } else {
                    count += 1;
                    if child.kind == MatchKind::Ok {
                        values.push(child.value);
                    }
                    let progress = child.end > current.position;
                    current.position = child.end;
                    current.environment = child.environment;
                    if count as f64 >= max
                        || (!progress && count as f64 >= min.max(1.0))
                        || (!current.open && current.position == current.input.len())
                    {
                        self.repeat_result(mc, start, current, count, min, children, values);
                    } else {
                        self.frames.push(Frame::Repeat {
                            node,
                            min,
                            max,
                            count,
                            start,
                            current,
                            children,
                            values,
                        });
                        self.frames.push(Frame::Match(node, current));
                    }
                }
            }
        }
        Ok(self.frames.is_empty())
    }

    fn set(
        &mut self,
        mc: &Mutation<'gc>,
        scope: Scope<'gc>,
        matched: bool,
        consume: bool,
        value: Value<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    ) {
        self.result = Some(Gc::new(
            mc,
            PatternMatch {
                kind: if matched {
                    MatchKind::Ok
                } else {
                    MatchKind::Fail
                },
                value: if matched {
                    value.wrap(mc, span(scope, scope.position + usize::from(consume)))
                } else {
                    Value::Undefined
                },
                start: scope.position,
                end: scope.position + usize::from(matched && consume),
                environment: scope.environment,
                origin: span(scope, scope.position + usize::from(matched && consume)),
                children,
            },
        ));
    }

    #[expect(
        clippy::too_many_arguments,
        reason = "mirrors the repetition frame's completion state"
    )]
    fn repeat_result(
        &mut self,
        mc: &Mutation<'gc>,
        start: Scope<'gc>,
        current: Scope<'gc>,
        count: usize,
        min: f64,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
        values: Vec<Value<'gc>>,
    ) {
        if (count as f64) < min {
            self.set(mc, start, false, false, Value::Undefined, children);
        } else {
            let origin = span(start, current.position);
            self.result = Some(Gc::new(
                mc,
                PatternMatch {
                    kind: MatchKind::Ok,
                    value: Value::array(mc, values).wrap(mc, origin),
                    start: start.position,
                    end: current.position,
                    environment: current.environment,
                    origin,
                    children,
                },
            ));
        }
    }
}

fn span(scope: Scope<'_>, end: usize) -> Origin {
    let point = scope
        .input
        .get(scope.position)
        .and_then(|value| value.origin())
        .map(|origin| origin.start)
        .or_else(|| {
            scope
                .input
                .last()
                .and_then(|value| value.origin())
                .map(|origin| origin.end)
        })
        .unwrap_or(scope.base);
    if end <= scope.position {
        Origin {
            start: point,
            end: point,
        }
    } else {
        Origin {
            start: point,
            end: scope.input[end - 1]
                .origin()
                .map_or(point, |origin| origin.end),
        }
    }
}

fn equal(
    source: &ValueSource,
    scope: Scope<'_>,
    same_value_zero: bool,
) -> Result<bool, PatternError> {
    match source {
        ValueSource::Variable { name } => {
            let expected = scope
                .environment
                .get(name)
                .ok_or_else(|| PatternError::UnknownValueReference(name.clone()))?;
            Ok(scope.input.get(scope.position).is_some_and(|value| {
                value.strict_eq(expected) || (same_value_zero &&
                    matches!((value.raw(), expected.raw()), (Value::Number(a), Value::Number(b)) if a.is_nan() && b.is_nan()))
            }))
        }
        ValueSource::Literal { value } => Ok(
            match (
                scope.input.get(scope.position).map(|value| value.raw()),
                value,
            ) {
                (Some(Value::Null), serde_json::Value::Null) => true,
                (Some(Value::Boolean(actual)), serde_json::Value::Bool(expected)) => {
                    actual == *expected
                }
                (Some(Value::Number(actual)), serde_json::Value::Number(expected)) => {
                    Some(actual) == expected.as_f64()
                }
                (Some(Value::String(actual)), serde_json::Value::String(expected)) => {
                    *actual == *expected
                }
                // Literal aggregates have independent identity and never compare
                // equal to an input aggregate under strict equality.
                _ => false,
            },
        ),
    }
}

fn source_value<'gc>(
    mc: &Mutation<'gc>,
    source: &ValueSource,
    scope: Scope<'gc>,
) -> Result<Value<'gc>, PatternError> {
    match source {
        ValueSource::Variable { name } => scope.environment.get(name)
            .ok_or_else(|| PatternError::UnknownValueReference(name.clone())),
        ValueSource::Literal { value } => Ok(Value::from_json(mc, value)),
    }
}

fn ordered_le(left: Value<'_>, right: Value<'_>) -> bool {
    match (left.raw(), right.raw()) {
        (Value::Number(left), Value::Number(right)) => left <= right,
        (Value::String(left), Value::String(right)) =>
            left.encode_utf16().cmp(right.encode_utf16()) != std::cmp::Ordering::Greater,
        _ => false,
    }
}

fn bound(
    source: Option<&ValueSource>,
    scope: Scope<'_>,
    name: &str,
    default: f64,
) -> Result<f64, PatternError> {
    let Some(source) = source else {
        return Ok(default);
    };
    let value = match source {
        ValueSource::Literal { value } => value.as_f64(),
        ValueSource::Variable { name } => match scope
            .environment
            .get(name)
            .ok_or_else(|| PatternError::UnknownValueReference(name.clone()))?
            .raw()
        {
            Value::Number(value) => Some(value),
            _ => None,
        },
    }
    .ok_or_else(|| PatternError::InvalidBound(format!("{name} must be a number")))?;
    if value < 0.0 {
        return Err(PatternError::InvalidBound(format!(
            "{name} must be 0 or greater but is {value}"
        )));
    }
    if value.is_nan() {
        return Err(PatternError::InvalidBound(format!(
            "{name} must be a number but is NaN"
        )));
    }
    if !(name == "max" && value == f64::INFINITY) && value.fract() != 0.0 {
        return Err(PatternError::InvalidBound(format!(
            "{name} must be an integer but is {value}"
        )));
    }
    Ok(value)
}

#[cfg(test)]
mod tests;

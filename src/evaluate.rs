use crate::coercion::{StringCoercionError, number_text, truthy};
use crate::environment::Environment;
use crate::expression::Expression;
use crate::globals::{self, IterableState, Iterator, NativeResult};
use crate::pattern::{
    MatchKind, Pattern, PatternError, PatternExecution, PatternMatch, PatternProgram,
};
use crate::program::{Key, Node, Program};
use crate::provenance::{Origin, concatenate};
use crate::value::{Closure, HostCallable, Value};
use crate::{json::JsonValue, text::RuntimeString};
use std::fmt;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};
use uffda_heap::{Arena, Collect, DynamicRoot, DynamicRootSet, Gc, Mutation, Rootable};

#[derive(Clone)]
pub struct RootedValue(DynamicRoot<Rootable![Value<'_>]>);

impl RootedValue {
    pub(crate) fn fetch<'gc>(
        &self,
        external: DynamicRootSet<'gc>,
    ) -> Result<Value<'gc>, EvaluationError> {
        external
            .try_fetch(&self.0)
            .map(|value| *value)
            .map_err(|_| EvaluationError::ForeignRoot)
    }
}

impl<'gc> ExpressionExecution<'gc> {
    fn input_source(&self) -> Option<crate::runtime::input::InputSource<'gc>> {
        match self.frames.last() {
            Some(Frame::Pull(iterator)) => match &*iterator.borrow() {
                IterableState::External { source, .. } if source.pending() => Some(*source),
                _ => None,
            },
            _ => None,
        }
    }

    pub fn input_pending(&self) -> bool {
        self.input_source().is_some()
            || matches!(self.frames.last(), Some(Frame::Parameters { execution, .. }) if execution.input_pending())
    }

    pub fn take_input_request(
        &mut self,
        mc: &Mutation<'gc>,
    ) -> Option<crate::runtime::input::InputRequest> {
        if let Some(source) = self.input_source() {
            return source.take_request(mc, self.external);
        }
        self.pattern_execution()?.take_input_request(mc)
    }

    pub fn complete_input(
        &mut self,
        mc: &Mutation<'gc>,
        request: &crate::runtime::input::InputRequest,
        completion: Result<crate::runtime::input::InputCompletion, String>,
    ) -> Result<(), EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = if let Some(source) = self.input_source() {
            source.complete(mc, self.external, request, completion)
        } else {
            self.pattern_execution()
                .ok_or(EvaluationError::StaleInputRequest)?
                .complete_input(mc, request, completion)
                .map_err(EvaluationError::Pattern)
        };
        if let Err(error) = &outcome
            && !is_stale_request(error)
        {
            self.fail(error.clone());
        }
        outcome
    }
}

/// Owned request arguments are roots, never borrowed arena values.
#[derive(Clone, Debug)]
pub struct HostRequest {
    pub callable: HostCallable,
    pub arguments: Vec<RootedValue>,
    token: Rc<()>,
}

type HostMaterializer =
    dyn for<'gc> FnOnce(&Mutation<'gc>, &[Value<'gc>]) -> Result<Value<'gc>, String>;

pub enum HostCompletion {
    Rooted(RootedValue),
    Materialize {
        roots: Vec<RootedValue>,
        build: Box<HostMaterializer>,
    },
}

impl HostCompletion {
    pub(crate) fn materialize_in<'gc>(
        self,
        mc: &Mutation<'gc>,
        external: DynamicRootSet<'gc>,
    ) -> Result<Value<'gc>, EvaluationError> {
        match self {
            Self::Rooted(root) => root.fetch(external),
            Self::Materialize { roots, build } => {
                let values: Result<Vec<_>, _> =
                    roots.iter().map(|root| root.fetch(external)).collect();
                values.and_then(|values| build(mc, &values).map_err(EvaluationError::Host))
            }
        }
    }
}

impl HostCompletion {
    /// All captured values must be ordinary owned host data; retained arena
    /// values are validated and supplied to the closure upon safe re-entry.
    pub fn materialize(
        roots: Vec<RootedValue>,
        build: impl for<'gc> FnOnce(&Mutation<'gc>, &[Value<'gc>]) -> Result<Value<'gc>, String>
        + 'static,
    ) -> Self {
        Self::Materialize {
            roots,
            build: Box::new(build),
        }
    }
}

#[derive(Collect)]
#[collect(no_drop)]
struct PendingHostCall<'gc> {
    callable: Gc<'gc, HostCallable>,
    arguments: Vec<Value<'gc>>,
    #[collect(require_static)]
    token: Rc<()>,
    issued: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StepStatus {
    Complete,
    Yielded,
    Suspended,
}

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
    NullishMember(RuntimeString),
    UnsupportedMember,
    ForeignRoot,
    InvalidState,
    StringCoercion(StringCoercionError),
    NotCallable,
    LambdaArguments,
    Pattern(PatternError),
    Native(String),
    Host(String),
    HostPending,
    StaleHostRequest,
    StaleInputRequest,
    Cancelled,
    Input(String),
}

impl fmt::Display for EvaluationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownReference(name) => write!(f, "unknown reference: {name}"),
            Self::NotIterable => write!(f, "array spread value is not iterable"),
            Self::InvalidPropertyKey => write!(f, "object computed key must be a string or number"),
            Self::NullishMember(name) => {
                write!(f, "cannot read property {name:?} of null or undefined")
            }
            Self::UnsupportedMember => write!(f, "member access for this value is not implemented"),
            Self::ForeignRoot => write!(f, "value belongs to another runtime"),
            Self::InvalidState => write!(f, "invalid expression evaluation stack"),
            Self::StringCoercion(error) => error.fmt(f),
            Self::NotCallable => write!(f, "Unable to invoke function: target is not callable"),
            Self::LambdaArguments => write!(f, "lambda: arguments did not match parameter pattern"),
            Self::Pattern(error) => write!(f, "lambda: {error}"),
            Self::Native(message) => f.write_str(message),
            Self::Host(message) => write!(f, "host invocation failed: {message}"),
            Self::HostPending => write!(f, "host invocation requires external completion"),
            Self::StaleHostRequest => {
                write!(f, "host request is stale or belongs to another execution")
            }
            Self::StaleInputRequest => {
                write!(f, "input request is stale or belongs to another execution")
            }
            Self::Cancelled => write!(f, "expression evaluation cancelled"),
            Self::Input(message) => write!(f, "input delivery failed: {message}"),
        }
    }
}

impl std::error::Error for EvaluationError {}

pub(crate) fn is_stale_request(error: &EvaluationError) -> bool {
    match error {
        EvaluationError::StaleHostRequest | EvaluationError::StaleInputRequest => true,
        EvaluationError::Pattern(PatternError::Expression(error)) => is_stale_request(error),
        _ => false,
    }
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct ExpressionExecution<'gc> {
    environment: Environment<'gc>,
    origin: Origin,
    matched_value: Value<'gc>,
    current_match: Option<Gc<'gc, PatternMatch<'gc>>>,
    subject: Option<Value<'gc>>,
    recovery: crate::runtime::input::RecoveryContext<'gc>,
    #[collect(require_static)]
    program: Rc<Program>,
    frames: Vec<Frame<'gc>>,
    values: Vec<Value<'gc>>,
    external: DynamicRootSet<'gc>,
    cli_globals: bool,
    items: Vec<Option<Value<'gc>>>,
    #[collect(require_static)]
    error: Option<EvaluationError>,
    host_call: Option<PendingHostCall<'gc>>,
}

type State<'gc> = ExpressionExecution<'gc>;

#[derive(Collect, Default)]
#[collect(require_static)]
// Pointer-free host bookkeeping needs no collector write barrier.
struct JsonPath(std::cell::RefCell<std::collections::HashSet<usize>>);

#[derive(Clone, Collect)]
#[collect(require_static)]
pub struct CompiledExpression(Rc<Program>);

impl CompiledExpression {
    pub fn new(expression: Expression) -> Self {
        Self(Program::compile(expression))
    }

    pub(crate) fn from_program(program: Rc<Program>) -> Self {
        Self(program)
    }

    pub fn bind<'gc>(
        &self,
        mc: &Mutation<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
        pattern: Pattern,
    ) -> Value<'gc> {
        self.bind_compiled(mc, environment, origin, PatternProgram::compile(pattern))
    }

    pub(crate) fn bind_compiled<'gc>(
        &self,
        mc: &Mutation<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
        pattern: Rc<PatternProgram>,
    ) -> Value<'gc> {
        Value::Lambda(Gc::new(
            mc,
            Closure {
                environment,
                origin,
                program: self.0.clone(),
                pattern,
                body: 0,
                subject: None,
            },
        ))
    }

    pub fn bind_subject<'gc>(
        &self,
        mc: &Mutation<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
        pattern: Pattern,
        subject: Value<'gc>,
    ) -> Value<'gc> {
        self.bind_compiled_subject(
            mc,
            environment,
            origin,
            PatternProgram::compile(pattern),
            subject,
        )
    }

    pub(crate) fn bind_compiled_subject<'gc>(
        &self,
        mc: &Mutation<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
        pattern: Rc<PatternProgram>,
        subject: Value<'gc>,
    ) -> Value<'gc> {
        Value::Lambda(Gc::new(
            mc,
            Closure {
                environment,
                origin,
                program: self.0.clone(),
                pattern,
                body: 0,
                subject: Some(subject),
            },
        ))
    }
}

impl<'gc> ExpressionExecution<'gc> {
    /// A resumable execution in the caller's arena; closures keep this arena's environment.
    pub fn new(
        mc: &Mutation<'gc>,
        expression: Expression,
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
    ) -> Self {
        Self::compiled(
            mc,
            Program::compile(expression),
            environment,
            origin,
            matched_value,
        )
    }

    pub fn from_compiled(
        mc: &Mutation<'gc>,
        expression: &CompiledExpression,
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
    ) -> Self {
        Self::compiled(mc, expression.0.clone(), environment, origin, matched_value)
    }

    pub fn with_match(
        mc: &Mutation<'gc>,
        expression: Expression,
        matched: Gc<'gc, PatternMatch<'gc>>,
    ) -> Self {
        let mut result = Self::new(
            mc,
            expression,
            matched.environment,
            matched.origin,
            matched.value,
        );
        result.current_match = Some(matched);
        result
    }

    pub fn from_compiled_match(
        mc: &Mutation<'gc>,
        expression: &CompiledExpression,
        matched: Gc<'gc, PatternMatch<'gc>>,
    ) -> Self {
        let mut result = Self::from_compiled(
            mc,
            expression,
            matched.environment,
            matched.origin,
            matched.value,
        );
        result.current_match = Some(matched);
        result
    }

    pub fn set_subject(&mut self, subject: Value<'gc>) {
        self.subject = Some(subject);
    }

    pub fn set_recovery(&mut self, recovery: crate::runtime::input::RecoveryContext<'gc>) {
        self.recovery = recovery;
    }

    pub fn set_match(&mut self, matched: Gc<'gc, PatternMatch<'gc>>) {
        self.environment = matched.environment;
        self.origin = matched.origin;
        self.matched_value = matched.value;
        self.current_match = Some(matched);
    }

    pub fn collect_iterable(
        mc: &Mutation<'gc>,
        value: Value<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
    ) -> Result<Self, EvaluationError> {
        let iterator = globals::iterator(mc, value)?;
        let mut result = Self::new(
            mc,
            Expression::Boolean { value: false },
            environment,
            origin,
            value,
        );
        result.frames = vec![Frame::Drain {
            iterator,
            result: vec![],
        }];
        Ok(result)
    }

    /// Serializes a rooted runtime value using the same continuation as `json`.
    /// The result is JSON text, or Undefined when JSON.stringify omits the value.
    pub fn serialize(
        mc: &Mutation<'gc>,
        value: Value<'gc>,
        environment: Environment<'gc>,
        origin: Origin,
    ) -> Self {
        let mut result = Self::new(
            mc,
            Expression::Boolean { value: false },
            environment,
            origin,
            value,
        );
        result.frames = vec![
            Frame::JsonFinish,
            Frame::JsonValue {
                value: value.unwrap_deep(mc),
                key: RuntimeString::default(),
                path: Gc::new(mc, JsonPath::default()),
                hook: true,
            },
        ];
        result
    }

    pub fn call(
        mc: &Mutation<'gc>,
        callee: Value<'gc>,
        args: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
    ) -> Self {
        let mut result = Self::new(
            mc,
            Expression::Boolean { value: false },
            environment,
            origin,
            matched_value,
        );
        result.frames = vec![Frame::Call(callee, args)];
        result
    }

    pub fn call_with_subject(
        mc: &Mutation<'gc>,
        callee: Value<'gc>,
        args: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        origin: Origin,
        subject: Value<'gc>,
    ) -> Self {
        let mut result = Self::new(
            mc,
            Expression::Boolean { value: false },
            environment,
            origin,
            Value::Undefined,
        );
        result.frames = vec![Frame::CallSubject(callee, args, subject)];
        result
    }

    pub(crate) fn compiled(
        mc: &Mutation<'gc>,
        program: Rc<Program>,
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
    ) -> Self {
        Self {
            environment,
            origin,
            matched_value,
            current_match: None,
            subject: None,
            recovery: crate::runtime::input::RecoveryContext::new(mc),
            program,
            frames: vec![Frame::Evaluate(0)],
            values: vec![],
            external: DynamicRootSet::new(mc),
            cli_globals: false,
            items: vec![],
            error: None,
            host_call: None,
        }
    }

    pub fn step(&mut self, mc: &Mutation<'gc>) -> Result<bool, EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        if self.host_pending() || self.input_pending() {
            return Ok(false);
        }
        let outcome = match self.frames.pop() {
            Some(frame) => {
                execute(frame, mc, self).map(|_| self.frames.is_empty() && self.host_call.is_none())
            }
            None => Ok(true),
        };
        if let Err(error) = &outcome {
            self.fail(error.clone());
        }
        outcome
    }

    fn fail(&mut self, error: EvaluationError) {
        self.error = Some(error);
        self.host_call = None;
        while let Some(frame) = self.frames.pop() {
            if let Frame::Restore {
                environment,
                program,
                origin,
                matched_value,
                current_match,
                subject,
            } = frame
            {
                self.environment = environment;
                self.program = program;
                self.origin = origin;
                self.matched_value = matched_value;
                self.current_match = current_match;
                self.subject = subject;
            }
        }
        self.values.clear();
        self.items.clear();
    }

    /// Advances one frame. Suspension requires a host completion or a pending
    /// rule/projection resolution; ordinary callable values do not imply it.
    pub fn step_status(&mut self, mc: &Mutation<'gc>) -> Result<StepStatus, EvaluationError> {
        if self.step(mc)? {
            Ok(StepStatus::Complete)
        } else if self.host_pending() || self.input_pending() || self.take_request().is_some() {
            Ok(StepStatus::Suspended)
        } else {
            Ok(StepStatus::Yielded)
        }
    }

    pub fn result(&self) -> Option<Value<'gc>> {
        if self.error.is_none()
            && self.host_call.is_none()
            && self.frames.is_empty()
            && self.values.len() == 1
        {
            self.values.first().copied()
        } else {
            None
        }
    }

    pub fn error(&self) -> Option<&EvaluationError> {
        self.error.as_ref()
    }

    pub fn host_pending(&self) -> bool {
        self.host_call.is_some()
            || matches!(self.frames.last(),
            Some(Frame::Parameters { execution, .. }) if execution.host_pending())
    }

    pub(crate) fn set_external(&mut self, external: DynamicRootSet<'gc>) {
        self.external = external;
        if let Some(execution) = self.pattern_execution() {
            execution.set_external(external);
        }
    }

    pub fn retain_value(&self, mc: &Mutation<'gc>, value: Value<'gc>) -> RootedValue {
        RootedValue(
            self.external
                .stash::<Rootable![Value<'_>]>(mc, Gc::new(mc, value)),
        )
    }

    pub fn fetch_rooted(&self, root: &RootedValue) -> Result<Value<'gc>, EvaluationError> {
        self.external
            .try_fetch(&root.0)
            .map(|value| *value)
            .map_err(|_| EvaluationError::ForeignRoot)
    }

    pub fn take_host_request(&mut self, mc: &Mutation<'gc>) -> Option<HostRequest> {
        if self.host_call.is_none() {
            let external = self.external;
            let execution = self.pattern_execution()?;
            execution.set_external(external);
            return execution.take_host_request(mc);
        }
        let pending = self.host_call.as_mut()?;
        if pending.issued {
            return None;
        }
        pending.issued = true;
        Some(HostRequest {
            callable: (*pending.callable).clone(),
            arguments: pending
                .arguments
                .iter()
                .map(|value| {
                    RootedValue(
                        self.external
                            .stash::<Rootable![Value<'_>]>(mc, Gc::new(mc, *value)),
                    )
                })
                .collect(),
            token: pending.token.clone(),
        })
    }

    pub fn complete_host(
        &mut self,
        mc: &Mutation<'gc>,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        if self.host_call.is_none() && self.host_pending() {
            let outcome = self
                .pattern_execution()
                .expect("pending parameter execution")
                .complete_host(mc, request, completion)
                .map_err(EvaluationError::Pattern);
            if let Err(error) = &outcome
                && !is_stale_request(error)
            {
                self.fail(error.clone());
            }
            return outcome;
        }
        if !self
            .host_call
            .as_ref()
            .is_some_and(|pending| pending.issued && Rc::ptr_eq(&pending.token, &request.token))
        {
            return Err(EvaluationError::StaleHostRequest);
        }
        let value = match completion {
            Err(message) => Err(EvaluationError::Host(message)),
            Ok(HostCompletion::Rooted(value)) => self
                .external
                .try_fetch(&value.0)
                .map(|value| *value)
                .map_err(|_| EvaluationError::ForeignRoot),
            Ok(HostCompletion::Materialize { roots, build }) => {
                let values: Result<Vec<_>, _> = roots
                    .iter()
                    .map(|root| {
                        self.external
                            .try_fetch(&root.0)
                            .map(|value| *value)
                            .map_err(|_| EvaluationError::ForeignRoot)
                    })
                    .collect();
                values.and_then(|values| build(mc, &values).map_err(EvaluationError::Host))
            }
        };
        match value {
            Ok(value) => {
                self.host_call = None;
                self.values.push(value);
                Ok(())
            }
            Err(error) => {
                self.fail(error.clone());
                Err(error)
            }
        }
    }

    pub fn cancel(&mut self) {
        if self.error.is_none() {
            self.fail(EvaluationError::Cancelled);
        }
    }

    /// Allows the module host to service pending rule/projection events in parameter matching.
    pub fn pattern_execution(&mut self) -> Option<&mut PatternExecution<'gc>> {
        match self.frames.last_mut() {
            Some(Frame::Parameters { execution, .. }) => Some(execution),
            _ => None,
        }
    }

    pub fn take_request(&self) -> Option<crate::pattern::PatternRequest<'gc>> {
        match self.frames.last() {
            Some(Frame::Parameters { execution, .. }) => execution.take_request(),
            _ => None,
        }
    }

    pub fn resume_resolve(
        &mut self,
        mc: &Mutation<'gc>,
        outcome: Gc<'gc, PatternMatch<'gc>>,
    ) -> Result<(), EvaluationError> {
        self.pattern_execution()
            .ok_or(EvaluationError::InvalidState)?
            .resume_resolve(mc, outcome)
            .map_err(EvaluationError::Pattern)
    }

    pub fn enable_cli_globals(&mut self) {
        self.cli_globals = true;
    }
}

#[derive(Collect)]
#[collect(no_drop)]
enum Frame<'gc> {
    Evaluate(usize),
    Literal(#[collect(require_static)] JsonValue),
    Array(Vec<bool>),
    Object(#[collect(require_static)] Vec<ObjectKey>),
    Member(RuntimeString),
    String(usize),
    ToString {
        value: Value<'gc>,
    },
    StringParts {
        parts: Vec<Value<'gc>>,
        index: usize,
        converted: Vec<Value<'gc>>,
        origin: Origin,
        carry_converted: bool,
    },
    StringPart {
        parts: Vec<Value<'gc>>,
        index: usize,
        converted: Vec<Value<'gc>>,
        origin: Origin,
        carry_converted: bool,
    },
    NativeStringArgument {
        global: globals::NativeGlobal,
        args: Vec<Value<'gc>>,
        index: usize,
    },
    JsonValue {
        value: Value<'gc>,
        key: RuntimeString,
        path: Gc<'gc, JsonPath>,
        hook: bool,
    },
    JsonHook {
        key: RuntimeString,
        path: Gc<'gc, JsonPath>,
    },
    JsonLeave {
        path: Gc<'gc, JsonPath>,
        container: Value<'gc>,
    },
    JsonArray(usize),
    JsonObject(Vec<RuntimeString>),
    JsonFinish,
    Not,
    Invoke(Vec<bool>),
    Call(Value<'gc>, Vec<Value<'gc>>),
    CallSubject(Value<'gc>, Vec<Value<'gc>>, Value<'gc>),
    Pull(Iterator<'gc>),
    CustomStarted(Iterator<'gc>),
    CustomNext(Iterator<'gc>),
    Transform(Iterator<'gc>),
    Transformed {
        iterator: Iterator<'gc>,
        item: Value<'gc>,
    },
    Drain {
        iterator: Iterator<'gc>,
        result: Vec<Value<'gc>>,
    },
    Drained {
        iterator: Iterator<'gc>,
        result: Vec<Value<'gc>>,
    },
    Spread {
        spreads: Vec<bool>,
        result: Vec<Value<'gc>>,
        index: usize,
        values: Vec<Value<'gc>>,
        invoke: bool,
    },
    SpreadDrained {
        spreads: Vec<bool>,
        result: Vec<Value<'gc>>,
        index: usize,
        values: Vec<Value<'gc>>,
        invoke: bool,
    },
    Reduce {
        iterator: Iterator<'gc>,
        callback: Value<'gc>,
        acc: Value<'gc>,
    },
    Reduced {
        iterator: Iterator<'gc>,
        callback: Value<'gc>,
    },
    ReduceItem {
        iterator: Iterator<'gc>,
        callback: Value<'gc>,
        acc: Value<'gc>,
    },
    Parameters {
        execution: Box<PatternExecution<'gc>>,
        closure: Gc<'gc, Closure<'gc>>,
        subject: Option<Value<'gc>>,
    },
    Restore {
        environment: Environment<'gc>,
        origin: Origin,
        matched_value: Value<'gc>,
        current_match: Option<Gc<'gc, PatternMatch<'gc>>>,
        subject: Option<Value<'gc>>,
        #[collect(require_static)]
        program: Rc<Program>,
    },
}

enum ObjectKey {
    Named(RuntimeString),
    Computed,
    Spread,
}

pub struct Evaluation {
    arena: Arena<Rootable![State<'_>]>,
    error: Option<EvaluationError>,
    result: Option<RootedValue>,
}

/// A local, executor-independent driver. Dropping it cancels unfinished work.
pub trait HostExecution {
    type Output;
    type Error;
    fn host_step_status(&mut self) -> Result<StepStatus, Self::Error>;
    fn host_request(&mut self) -> Option<HostRequest>;
    fn host_complete(
        &mut self,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), Self::Error>;
    fn host_finish(&mut self) -> Result<Self::Output, Self::Error>;
    fn host_cancel(&mut self);
    fn host_invalid_state(&self) -> Self::Error;
    fn host_unavailable(&self) -> Self::Error;

    fn external_request(&mut self) -> Option<ExternalRequest> {
        self.host_request().map(ExternalRequest::Host)
    }
    fn external_complete(
        &mut self,
        request: &ExternalRequest,
        completion: ExternalCompletion,
    ) -> Result<(), Self::Error> {
        match (request, completion) {
            (ExternalRequest::Host(request), ExternalCompletion::Host(completion)) => {
                self.host_complete(request, completion)
            }
            _ => Err(self.host_invalid_state()),
        }
    }
}

#[derive(Clone, Debug)]
pub enum ExternalRequest {
    Host(HostRequest),
    Input(crate::runtime::input::InputRequest),
}

pub enum ExternalCompletion {
    Host(Result<HostCompletion, String>),
    Input(Result<crate::runtime::input::InputCompletion, String>),
}

pub trait DriverProtocol<E: HostExecution> {
    type Request: Clone;
    type Completion;
    fn request(execution: &mut E) -> Option<Self::Request>;
    fn complete(
        execution: &mut E,
        request: &Self::Request,
        completion: Self::Completion,
    ) -> Result<(), E::Error>;
}

pub struct HostProtocol;
pub struct ExternalProtocol;
impl<E: HostExecution> DriverProtocol<E> for HostProtocol {
    type Request = HostRequest;
    type Completion = Result<HostCompletion, String>;
    fn request(execution: &mut E) -> Option<Self::Request> {
        execution.host_request()
    }
    fn complete(
        execution: &mut E,
        request: &Self::Request,
        completion: Self::Completion,
    ) -> Result<(), E::Error> {
        execution.host_complete(request, completion)
    }
}
impl<E: HostExecution> DriverProtocol<E> for ExternalProtocol {
    type Request = ExternalRequest;
    type Completion = ExternalCompletion;
    fn request(execution: &mut E) -> Option<Self::Request> {
        execution.external_request()
    }
    fn complete(
        execution: &mut E,
        request: &Self::Request,
        completion: Self::Completion,
    ) -> Result<(), E::Error> {
        execution.external_complete(request, completion)
    }
}

pub type EvaluationDriver<'a, H, F> = HostDriver<'a, Evaluation, H, F>;
pub type ExternalDriver<'a, E, H, F> = HostDriver<'a, E, H, F, ExternalProtocol>;

pub struct HostDriver<'a, E: HostExecution, H, F, P: DriverProtocol<E> = HostProtocol> {
    evaluation: &'a mut E,
    host: Box<H>,
    future: Option<Pin<Box<F>>>,
    request: Option<P::Request>,
    protocol: std::marker::PhantomData<fn() -> P>,
    finished: bool,
}

impl<'a, E: HostExecution, H, F, P: DriverProtocol<E>> HostDriver<'a, E, H, F, P> {
    pub fn new(evaluation: &'a mut E, host: H) -> Self {
        Self {
            evaluation,
            host: Box::new(host),
            future: None,
            request: None,
            finished: false,
            protocol: std::marker::PhantomData,
        }
    }
}

impl<E, H, F, P> Future for HostDriver<'_, E, H, F, P>
where
    E: HostExecution,
    P: DriverProtocol<E>,
    P::Request: Unpin,
    H: FnMut(&mut E, P::Request) -> F,
    F: Future<Output = P::Completion>,
{
    type Output = Result<E::Output, E::Error>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let driver = self.get_mut();
        if driver.finished {
            return Poll::Ready(Err(driver.evaluation.host_invalid_state()));
        }
        // Bound work per poll even for entirely immediate expressions.
        for _ in 0..64 {
            if let Some(future) = &mut driver.future {
                let completion = match future.as_mut().poll(cx) {
                    Poll::Pending => return Poll::Pending,
                    Poll::Ready(completion) => completion,
                };
                driver.future = None;
                let request = driver.request.take().expect("future owns a request");
                if let Err(error) = P::complete(driver.evaluation, &request, completion) {
                    driver.evaluation.host_cancel();
                    driver.finished = true;
                    return Poll::Ready(Err(error));
                }
            }
            match driver.evaluation.host_step_status() {
                Ok(StepStatus::Complete) => {
                    driver.finished = true;
                    return Poll::Ready(driver.evaluation.host_finish());
                }
                Ok(StepStatus::Yielded) => {}
                Ok(StepStatus::Suspended) => {
                    let Some(request) = P::request(driver.evaluation) else {
                        let error = driver.evaluation.host_unavailable();
                        driver.evaluation.host_cancel();
                        driver.finished = true;
                        return Poll::Ready(Err(error));
                    };
                    driver.future =
                        Some(Box::pin((driver.host)(driver.evaluation, request.clone())));
                    driver.request = Some(request);
                }
                Err(error) => {
                    driver.finished = true;
                    return Poll::Ready(Err(error));
                }
            }
        }
        cx.waker().wake_by_ref();
        Poll::Pending
    }
}

impl<E: HostExecution, H, F, P: DriverProtocol<E>> Drop for HostDriver<'_, E, H, F, P> {
    fn drop(&mut self) {
        if !self.finished {
            self.evaluation.host_cancel();
        }
    }
}

impl HostExecution for Evaluation {
    type Output = RootedValue;
    type Error = EvaluationError;
    fn host_step_status(&mut self) -> Result<StepStatus, Self::Error> {
        self.step_status()
    }
    fn host_request(&mut self) -> Option<HostRequest> {
        self.take_host_request()
    }
    fn host_complete(
        &mut self,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), Self::Error> {
        self.complete_host(request, completion)
    }
    fn host_finish(&mut self) -> Result<Self::Output, Self::Error> {
        self.finish()
    }
    fn host_cancel(&mut self) {
        self.cancel();
    }
    fn host_invalid_state(&self) -> Self::Error {
        EvaluationError::InvalidState
    }
    fn host_unavailable(&self) -> Self::Error {
        EvaluationError::HostPending
    }
    fn external_request(&mut self) -> Option<ExternalRequest> {
        self.take_input_request()
            .map(ExternalRequest::Input)
            .or_else(|| self.take_host_request().map(ExternalRequest::Host))
    }
    fn external_complete(
        &mut self,
        request: &ExternalRequest,
        completion: ExternalCompletion,
    ) -> Result<(), Self::Error> {
        match (request, completion) {
            (ExternalRequest::Host(request), ExternalCompletion::Host(completion)) => {
                self.complete_host(request, completion)
            }
            (ExternalRequest::Input(request), ExternalCompletion::Input(completion)) => {
                self.complete_input(request, completion)
            }
            _ => Err(EvaluationError::InvalidState),
        }
    }
}

impl Evaluation {
    pub fn drive_external<H, F>(&mut self, host: H) -> ExternalDriver<'_, Self, H, F>
    where
        H: FnMut(&mut Self, ExternalRequest) -> F,
        F: Future<Output = ExternalCompletion>,
    {
        HostDriver::new(self, host)
    }

    pub fn take_input_request(&mut self) -> Option<crate::runtime::input::InputRequest> {
        self.arena
            .mutate_root(|mc, state| state.take_input_request(mc))
    }

    pub fn complete_input(
        &mut self,
        request: &crate::runtime::input::InputRequest,
        completion: Result<crate::runtime::input::InputCompletion, String>,
    ) -> Result<(), EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = self
            .arena
            .mutate_root(|mc, state| state.complete_input(mc, request, completion));
        if let Err(error) = &outcome
            && !is_stale_request(error)
        {
            self.error = Some(error.clone());
        }
        self.arena.collect_debt();
        outcome
    }

    pub fn new(expression: Expression) -> Self {
        Self::with_environment(expression, |mc| Environment::new(mc, None, vec![]))
    }

    /// Registers explicit callable metadata in an ordinary lexical environment.
    pub fn with_hosts(expression: Expression, callables: Vec<HostCallable>) -> Self {
        Self::with_environment(expression, |mc| {
            Environment::new(
                mc,
                None,
                callables
                    .into_iter()
                    .map(|callable| {
                        (
                            std::rc::Rc::<str>::from(callable.name.clone()),
                            Value::host(mc, callable),
                        )
                    })
                    .collect(),
            )
        })
    }

    /// The handler runs outside mutation scopes and may synchronously read
    /// rooted arguments through this evaluation before constructing its future.
    /// The returned future cannot borrow this evaluation or arena values.
    pub fn drive<H, F>(&mut self, host: H) -> EvaluationDriver<'_, H, F>
    where
        H: FnMut(&mut Evaluation, HostRequest) -> F,
        F: Future<Output = Result<HostCompletion, String>>,
    {
        HostDriver::new(self, host)
    }

    pub fn take_host_request(&mut self) -> Option<HostRequest> {
        self.arena
            .mutate_root(|mc, state| state.take_host_request(mc))
    }

    pub fn complete_host(
        &mut self,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = self
            .arena
            .mutate_root(|mc, state| state.complete_host(mc, request, completion));
        if let Err(error) = &outcome
            && !is_stale_request(error)
        {
            self.error = Some(error.clone());
        }
        self.arena.collect_debt();
        outcome
    }

    pub fn cancel(&mut self) {
        if self.error.is_none() {
            self.arena.mutate_root(|_, state| state.cancel());
            self.error = Some(EvaluationError::Cancelled);
            self.result = None;
            self.collect();
        }
    }

    /// CLI exec adds only its documented identity fixture, `echo`.
    pub fn with_cli_globals(expression: Expression) -> Self {
        let mut evaluation = Self::new(expression);
        evaluation
            .arena
            .mutate_root(|_, state| state.cli_globals = true);
        evaluation
    }

    pub fn with_match(
        expression: Expression,
        build: impl for<'gc> FnOnce(&Mutation<'gc>) -> Gc<'gc, PatternMatch<'gc>>,
    ) -> Self {
        Self {
            arena: Arena::new(|mc| ExpressionExecution::with_match(mc, expression, build(mc))),
            error: None,
            result: None,
        }
    }

    pub fn with_environment(
        expression: Expression,
        build: impl for<'gc> FnOnce(&Mutation<'gc>) -> Environment<'gc>,
    ) -> Self {
        let program = Program::compile(expression);
        Self {
            arena: Arena::new(|mc| {
                let environment = build(mc);
                let mut initial = PatternExecution::new(mc, Pattern::Ok, vec![], environment);
                while !initial
                    .step(mc)
                    .expect("the empty initial match cannot fail")
                {}
                let mut execution = State::compiled(
                    mc,
                    program,
                    environment,
                    Origin { start: 0, end: 0 },
                    Value::Undefined,
                );
                execution.set_match(initial.result().expect("completed initial match"));
                execution
            }),
            error: None,
            result: None,
        }
    }

    /// Executes one frame, then permits collection before the next frame.
    /// `HostPending` is non-sticky: service the request and continue, or use
    /// `step_status` / `drive` when host suspension is expected.
    pub fn step(&mut self) -> Result<bool, EvaluationError> {
        match self.step_status()? {
            StepStatus::Complete => Ok(true),
            StepStatus::Yielded => Ok(false),
            StepStatus::Suspended => Err(EvaluationError::HostPending),
        }
    }

    pub fn step_status(&mut self) -> Result<StepStatus, EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        // A standalone evaluation has no resolver host, so a pending rule or
        // projection request can never be resumed and must fail instead of spinning.
        let outcome: Result<StepStatus, EvaluationError> =
            self.arena
                .mutate_root(|mc, state| match state.step_status(mc)? {
                    StepStatus::Suspended if !state.host_pending() && !state.input_pending() => {
                        let error = unserviceable_request(state.take_request());
                        state.fail(error.clone());
                        Err(error)
                    }
                    status => Ok(status),
                });
        if let Err(error) = &outcome {
            self.error = Some(error.clone());
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
            if state.host_pending() || state.values.len() != 1 {
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

    /// Serializes a completed value without copying it out of its arena.
    /// The original root remains valid; the returned root contains text or Undefined.
    pub fn serialize_rooted(
        &mut self,
        value: &RootedValue,
    ) -> Result<RootedValue, EvaluationError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        self.arena.mutate_root(|mc, state| {
            if state.host_pending() || !state.frames.is_empty() {
                return Err(EvaluationError::InvalidState);
            }
            let value = *state
                .external
                .try_fetch(&value.0)
                .map_err(|_| EvaluationError::ForeignRoot)?;
            state.values.clear();
            state.frames = vec![
                Frame::JsonFinish,
                Frame::JsonValue {
                    value: value.unwrap_deep(mc),
                    key: RuntimeString::default(),
                    path: Gc::new(mc, JsonPath::default()),
                    hook: true,
                },
            ];
            Ok(())
        })?;
        self.result = None;
        self.finish()
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

fn unserviceable_request(request: Option<crate::pattern::PatternRequest<'_>>) -> EvaluationError {
    let name = request
        .and_then(|request| request.name.or(request.value))
        .unwrap_or_default();
    EvaluationError::Pattern(PatternError::Expression(Box::new(
        EvaluationError::UnknownReference(name),
    )))
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
            Node::Undefined => state.values.push(Value::Undefined),
            Node::Value(value) => state.frames.push(Frame::Literal(value.clone())),
            Node::Reference(name) if name == "_" => state.values.push(state.matched_value),
            Node::Reference(name) if name == "this" => state.values.push(match state.subject {
                Some(subject) => subject,
                None => Value::Match(
                    state
                        .current_match
                        .ok_or_else(|| EvaluationError::UnknownReference(name.clone()))?,
                ),
            }),
            Node::Reference(name) => state.values.push(
                state
                    .environment
                    .get(name)
                    .or_else(|| globals::lookup(name).map(Value::Native))
                    .or_else(|| {
                        (state.cli_globals && name == "echo")
                            .then_some(Value::Native(globals::NativeGlobal::Id))
                    })
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
                        subject: None,
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
            JsonValue::Null => state.values.push(Value::Null),
            JsonValue::Bool(value) => state.values.push(Value::Boolean(value)),
            JsonValue::Number(value) => state.values.push(Value::Number(
                value.as_f64().ok_or(EvaluationError::InvalidState)?,
            )),
            JsonValue::String(value) => state.values.push(Value::string(mc, value)),
            JsonValue::Array(values) => {
                state.frames.push(Frame::Array(vec![false; values.len()]));
                state
                    .frames
                    .extend(values.into_iter().rev().map(Frame::Literal));
            }
            JsonValue::Object(values) => {
                state.frames.push(Frame::Object(
                    values
                        .iter()
                        .map(|(k, _)| ObjectKey::Named(k.clone()))
                        .collect(),
                ));
                state
                    .frames
                    .extend(values.into_iter().map(|(_, v)| v).rev().map(Frame::Literal));
            }
        },
        Frame::Array(spreads) => {
            let values = take_values(&mut state.values, spreads.len())?;
            state.frames.push(Frame::Spread {
                spreads,
                values,
                result: vec![],
                index: 0,
                invoke: false,
            });
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
            let mut symbols = Vec::new();
            for key in keys {
                let value = values.next().ok_or(EvaluationError::InvalidState)?;
                match key {
                    ObjectKey::Named(name) => result.push((name, value)),
                    ObjectKey::Computed => {
                        let item = values.next().ok_or(EvaluationError::InvalidState)?;
                        match value.raw() {
                            Value::Symbol(name) => {
                                symbols.push(((*name).clone(), item.unwrap_deep(mc)))
                            }
                            Value::String(name) => result.push(((*name).clone(), item)),
                            Value::Number(name) => result.push((number_text(name).into(), item)),
                            _ => return Err(EvaluationError::InvalidPropertyKey),
                        }
                    }
                    ObjectKey::Spread => {
                        match value.raw() {
                            Value::Declaration(declaration) => {
                                result.extend(
                                    declaration.properties.borrow().entries().iter().cloned(),
                                );
                            }
                            Value::Object(properties) => {
                                symbols.extend(properties.borrow().symbol_entries().iter().map(
                                    |(name, item)| {
                                        (
                                            name.clone(),
                                            item.wrap(mc, value.origin().unwrap_or(state.origin)),
                                        )
                                    },
                                ));
                                result.extend(properties.borrow().entries().iter().map(
                                    |(name, item)| {
                                        (
                                            name.clone(),
                                            item.wrap(mc, value.origin().unwrap_or(state.origin)),
                                        )
                                    },
                                ));
                            }
                            Value::Array(values) => result.extend(
                                values.borrow().iter().enumerate().map(|(i, item)| {
                                    (i.to_string().into(), value.carry_item(mc, *item, i))
                                }),
                            ),
                            // Current object spreading ignores non-object primitives.
                            _ => {}
                        }
                    }
                }
            }
            let object = Value::object(mc, result);
            if let Value::Object(storage) = object {
                for (name, item) in symbols {
                    storage.borrow_mut(mc).set_symbol(name, item);
                }
            }
            state.values.push(object);
        }
        Frame::Member(name) => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            let scalar_name = name.to_utf8().ok();
            if name == "toString"
                && !matches!(
                    value.raw(),
                    Value::Undefined
                        | Value::Null
                        | Value::Boolean(_)
                        | Value::Number(_)
                        | Value::String(_)
                        | Value::Symbol(_)
                )
            {
                return Err(EvaluationError::UnsupportedMember);
            }
            let property = match value.raw() {
                Value::Native(global) if name == "name" => Value::string(mc, global.name()),
                Value::Native(global) if name == "length" => Value::Number(global.arity() as f64),
                Value::Host(callable) if name == "name" => Value::string(mc, callable.name.clone()),
                Value::Host(callable) if name == "length" => Value::Number(callable.arity as f64),
                Value::Lambda(_) if name == "name" => Value::string(mc, "callable"),
                Value::Lambda(_) | Value::IteratorFactory(_) if name == "length" => {
                    Value::Number(0.0)
                }
                Value::IteratorFactory(_) if name == "name" => {
                    Value::string(mc, "[Symbol.asyncIterator]")
                }
                Value::Native(_)
                | Value::Host(_)
                | Value::Lambda(_)
                | Value::IteratorFactory(_) => match scalar_name.as_deref().unwrap_or("") {
                    "call" | "apply" | "bind" | "toString" | "constructor" | "prototype" => {
                        return Err(EvaluationError::UnsupportedMember);
                    }
                    _ => Value::Undefined,
                },
                Value::Object(properties) => {
                    properties.borrow().get(&name).unwrap_or(Value::Undefined)
                }
                Value::Declaration(declaration) => declaration
                    .properties
                    .borrow()
                    .get(&name)
                    .unwrap_or(Value::Undefined),
                Value::Url(url) => match scalar_name.as_deref().unwrap_or("") {
                    "href" => Value::string(mc, url.0.as_str()),
                    _ => return Err(EvaluationError::UnsupportedMember),
                },
                Value::Match(matched) => match scalar_name.as_deref().unwrap_or("") {
                    "kind" => Value::string(
                        mc,
                        match matched.kind {
                            MatchKind::Ok => "ok",
                            MatchKind::Skip => "skip",
                            MatchKind::Fail => "fail",
                        },
                    ),
                    "value" => matched.value,
                    "originalSpan" => Value::object(
                        mc,
                        vec![
                            ("start".into(), Value::Number(matched.origin.start as f64)),
                            ("end".into(), Value::Number(matched.origin.end as f64)),
                        ],
                    ),
                    "matches" => Value::array(
                        mc,
                        matched.children.iter().copied().map(Value::Match).collect(),
                    ),
                    "pattern" | "scope" | "span" => return Err(EvaluationError::UnsupportedMember),
                    _ => Value::Undefined,
                },
                Value::Array(values) if name == "length" => {
                    Value::Number(values.borrow().len() as f64)
                }
                Value::Array(values) => match array_index(&name) {
                    Some(index) => values
                        .borrow()
                        .get(index)
                        .copied()
                        .unwrap_or(Value::Undefined),
                    None => match scalar_name.as_deref().unwrap_or("") {
                        "constructor" | "toString" | "valueOf" | "map" | "filter" | "reduce"
                        | "slice" | "join" | "at" | "push" | "pop" | "entries" | "keys"
                        | "values" => return Err(EvaluationError::UnsupportedMember),
                        _ => Value::Undefined,
                    },
                },
                Value::String(text) if name == "length" => Value::Number(text.len() as f64),
                Value::String(text) => {
                    match array_index(&name).and_then(|index| text.as_utf16().get(index).copied()) {
                        Some(unit) => Value::string(mc, RuntimeString::from_utf16(vec![unit])),
                        None => match scalar_name.as_deref().unwrap_or("") {
                            "constructor" | "toString" | "valueOf" | "slice" | "substring"
                            | "charAt" | "charCodeAt" | "at" | "includes" | "split" | "replace"
                            | "match" | "trim" => return Err(EvaluationError::UnsupportedMember),
                            _ => Value::Undefined,
                        },
                    }
                }
                Value::Set(values) | Value::Map(values) if name == "size" => {
                    Value::Number(values.borrow().len() as f64)
                }
                Value::Bytes(bytes) if name == "length" => Value::Number(bytes.len() as f64),
                Value::Bytes(bytes) => array_index(&name)
                    .and_then(|i| bytes.get(i))
                    .map(|byte| Value::Number(*byte as f64))
                    .unwrap_or(Value::Undefined),
                Value::Boolean(_) | Value::Number(_) | Value::Symbol(_) => {
                    match scalar_name.as_deref().unwrap_or("") {
                        "toString" | "valueOf" | "constructor" | "toLocaleString" => {
                            return Err(EvaluationError::UnsupportedMember);
                        }
                        _ => Value::Undefined,
                    }
                }
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
            state.frames.push(Frame::StringParts {
                parts: values,
                index: 0,
                converted: vec![],
                origin: state.origin,
                carry_converted: false,
            });
        }
        Frame::ToString { value } => {
            state.values.push(Value::string(
                mc,
                crate::coercion::string_text(value).map_err(EvaluationError::StringCoercion)?,
            ));
        }
        Frame::StringParts {
            parts,
            mut index,
            mut converted,
            origin,
            carry_converted,
        } => {
            while let Some(part) = parts
                .get(index)
                .copied()
                .filter(|v| matches!(v.raw(), Value::String(_)))
            {
                converted.push(part);
                index += 1;
            }
            if index == parts.len() {
                state.values.push(
                    concatenate(mc, &converted, origin).map_err(EvaluationError::StringCoercion)?,
                );
            } else {
                let value = parts[index];
                state.frames.push(Frame::StringPart {
                    parts,
                    index,
                    converted,
                    origin,
                    carry_converted,
                });
                state.frames.push(Frame::ToString { value });
            }
        }
        Frame::StringPart {
            parts,
            index,
            mut converted,
            origin,
            carry_converted,
        } => {
            let converted_part = state
                .values
                .pop()
                .ok_or(EvaluationError::InvalidState)?
                .raw();
            converted.push(if carry_converted {
                converted_part.wrap(mc, parts[index].origin().unwrap_or(origin))
            } else {
                converted_part
            });
            state.frames.push(Frame::StringParts {
                parts,
                index: index + 1,
                converted,
                origin,
                carry_converted,
            });
        }
        Frame::NativeStringArgument {
            global,
            mut args,
            index,
        } => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            while args.len() <= index {
                args.push(Value::Undefined);
            }
            args[index] = value;
            match globals::invoke(mc, global, args, state.origin)? {
                NativeResult::Value(value) => state.values.push(value),
                _ => return Err(EvaluationError::InvalidState),
            }
        }
        Frame::JsonFinish => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            state.values.push(match globals::json_text(value)? {
                Some(text) => Value::string(mc, text),
                None => Value::Undefined,
            });
        }
        Frame::JsonValue {
            value,
            key,
            path,
            hook,
        } => {
            if matches!(
                value.raw(),
                Value::Native(_) | Value::Host(_) | Value::Lambda(_) | Value::IteratorFactory(_)
            ) {
                return Err(EvaluationError::Native(
                    "cannot serialize callable to JSON".into(),
                ));
            }
            if let Value::Declaration(declaration) = value.raw() {
                state.frames.push(Frame::JsonValue {
                    value: Value::Object(declaration.properties),
                    key,
                    path,
                    hook,
                });
                return Ok(());
            }
            if hook
                && let Value::Object(object) = value.raw()
                && let Some(method) = object.borrow().get("toJSON").filter(|v| {
                    matches!(
                        v.raw(),
                        Value::Lambda(_)
                            | Value::Native(_)
                            | Value::Host(_)
                            | Value::IteratorFactory(_)
                    )
                })
            {
                state.frames.push(Frame::JsonHook {
                    key: key.clone(),
                    path,
                });
                state
                    .frames
                    .push(Frame::Call(method, vec![Value::string(mc, key)]));
            } else {
                match value.raw() {
                    Value::Array(array) => {
                        let id = Gc::as_ptr(array) as usize;
                        if !path.0.borrow_mut().insert(id) {
                            return Err(EvaluationError::Native(
                                "Converting circular structure to JSON".into(),
                            ));
                        }
                        let items = array.borrow();
                        state.frames.push(Frame::JsonLeave {
                            path,
                            container: value,
                        });
                        state.frames.push(Frame::JsonArray(items.len()));
                        state
                            .frames
                            .extend(items.iter().enumerate().rev().map(|(i, value)| {
                                Frame::JsonValue {
                                    value: *value,
                                    key: i.to_string().into(),
                                    path,
                                    hook: true,
                                }
                            }));
                    }
                    Value::Object(object) => {
                        let id = Gc::as_ptr(object) as usize;
                        if !path.0.borrow_mut().insert(id) {
                            return Err(EvaluationError::Native(
                                "Converting circular structure to JSON".into(),
                            ));
                        }
                        let properties = object.borrow();
                        state.frames.push(Frame::JsonLeave {
                            path,
                            container: value,
                        });
                        state.frames.push(Frame::JsonObject(
                            properties
                                .entries()
                                .iter()
                                .map(|(key, _)| key.clone())
                                .collect(),
                        ));
                        state.frames.extend(properties.entries().iter().rev().map(
                            |(key, value)| Frame::JsonValue {
                                value: *value,
                                key: key.clone(),
                                path,
                                hook: true,
                            },
                        ));
                    }
                    _ => state.values.push(value),
                }
            }
        }
        Frame::JsonHook { key, path } => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            state.frames.push(Frame::JsonValue {
                value,
                key,
                path,
                hook: false,
            });
        }
        Frame::JsonLeave { path, container } => {
            let id = match container.raw() {
                Value::Array(array) => Gc::as_ptr(array) as usize,
                Value::Object(object) => Gc::as_ptr(object) as usize,
                _ => return Err(EvaluationError::InvalidState),
            };
            if !path.0.borrow_mut().remove(&id) {
                return Err(EvaluationError::InvalidState);
            }
        }
        Frame::JsonArray(count) => {
            let values = take_values(&mut state.values, count)?;
            state.values.push(Value::array(mc, values));
        }
        Frame::JsonObject(keys) => {
            let values = take_values(&mut state.values, keys.len())?;
            let values = keys.into_iter().zip(values).collect();
            state.values.push(Value::object(mc, values));
        }
        Frame::Invoke(spreads) => {
            let values = take_values(&mut state.values, spreads.len() + 1)?;
            let mut all_spreads = vec![false];
            all_spreads.extend(spreads);
            state.frames.push(Frame::Spread {
                spreads: all_spreads,
                values,
                result: vec![],
                index: 0,
                invoke: true,
            });
        }
        Frame::CallSubject(callee, args, subject) => match callee.raw() {
            Value::Lambda(closure) => state.frames.push(Frame::Parameters {
                execution: Box::new(PatternExecution::compiled_with_recovery(
                    mc,
                    closure.pattern.clone(),
                    args,
                    closure.environment,
                    closure.origin.start,
                    state.recovery,
                )),
                closure,
                subject: Some(subject),
            }),
            _ => state.frames.push(Frame::Call(callee, args)),
        },
        Frame::Call(callee, args) => match callee.raw() {
            Value::Host(callable) => {
                state.host_call = Some(PendingHostCall {
                    callable,
                    arguments: args,
                    token: Rc::new(()),
                    issued: false,
                });
            }
            Value::IteratorFactory(source) => state
                .values
                .push(Value::Iterable(globals::iterator(mc, *source)?)),
            Value::Lambda(closure) => state.frames.push(Frame::Parameters {
                execution: Box::new(PatternExecution::compiled_with_recovery(
                    mc,
                    closure.pattern.clone(),
                    args,
                    closure.environment,
                    closure.origin.start,
                    state.recovery,
                )),
                closure,
                subject: closure.subject,
            }),
            Value::Native(
                global @ (globals::NativeGlobal::Join | globals::NativeGlobal::Format),
            ) => {
                let origin = args
                    .first()
                    .and_then(|v| v.origin())
                    .unwrap_or(state.origin);
                let parts = if global == globals::NativeGlobal::Join {
                    globals::join_parts(mc, &args)?
                } else {
                    globals::format_parts(mc, &args)?
                };
                let parts = parts
                    .into_iter()
                    .map(|value| match value.raw() {
                        Value::Symbol(name) => Value::string(mc, globals::symbol_text(&name)),
                        _ => value,
                    })
                    .collect();
                state.frames.push(Frame::StringParts {
                    parts,
                    index: 0,
                    converted: vec![],
                    origin,
                    carry_converted: false,
                });
            }
            Value::Native(
                global @ (globals::NativeGlobal::Int | globals::NativeGlobal::Symbol),
            ) => {
                let value = args.first().copied().unwrap_or(Value::Undefined);
                let value = if global == globals::NativeGlobal::Int
                    && let Value::Symbol(name) = value.raw()
                {
                    Value::string(mc, globals::symbol_text(&name))
                } else {
                    value
                };
                state.frames.push(Frame::NativeStringArgument {
                    global,
                    args,
                    index: 0,
                });
                state.frames.push(Frame::ToString { value });
            }
            Value::Native(globals::NativeGlobal::Json) => {
                let value = args
                    .first()
                    .copied()
                    .unwrap_or(Value::Undefined)
                    .unwrap_deep(mc);
                state.frames.push(Frame::JsonFinish);
                state.frames.push(Frame::JsonValue {
                    value,
                    key: RuntimeString::default(),
                    path: Gc::new(mc, JsonPath::default()),
                    hook: true,
                });
            }
            Value::Native(global @ (globals::NativeGlobal::Has | globals::NativeGlobal::Pluck))
                if global == globals::NativeGlobal::Pluck
                    || args
                        .first()
                        .is_some_and(|value| matches!(value.raw(), Value::Object(_))) =>
            {
                let key = args.get(1).copied().unwrap_or(Value::Undefined);
                if matches!(key.raw(), Value::Symbol(_)) {
                    let NativeResult::Value(value) =
                        globals::invoke(mc, global, args, state.origin)?
                    else {
                        return Err(EvaluationError::InvalidState);
                    };
                    state.values.push(value);
                } else {
                    state.frames.push(Frame::NativeStringArgument {
                        global,
                        args,
                        index: 1,
                    });
                    state.frames.push(Frame::ToString { value: key });
                }
            }
            Value::Native(global) => match globals::invoke(mc, global, args, state.origin)? {
                NativeResult::Value(value) => state.values.push(value),
                NativeResult::Reduce {
                    source,
                    callback,
                    acc,
                } => state.frames.push(Frame::Reduce {
                    iterator: source,
                    callback,
                    acc,
                }),
            },
            _ => return Err(EvaluationError::NotCallable),
        },
        Frame::Spread {
            spreads,
            mut result,
            mut index,
            values,
            invoke,
        } => {
            while index < values.len() && !spreads[index] {
                result.push(values[index]);
                index += 1;
            }
            if index == values.len() {
                if invoke {
                    let callee = result.remove(0);
                    state.frames.push(Frame::Call(callee, result));
                } else {
                    state.values.push(Value::array(mc, result));
                }
            } else {
                let iterator = globals::iterator(mc, values[index])
                    .map_err(|_| EvaluationError::NotIterable)?;
                state.frames.push(Frame::SpreadDrained {
                    spreads,
                    result,
                    index: index + 1,
                    values,
                    invoke,
                });
                state.frames.push(Frame::Drain {
                    iterator,
                    result: vec![],
                });
            }
        }
        Frame::SpreadDrained {
            spreads,
            mut result,
            index,
            values,
            invoke,
        } => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            let Value::Array(array) = value.raw() else {
                return Err(EvaluationError::InvalidState);
            };
            result.extend(array.borrow().iter().copied());
            state.frames.push(Frame::Spread {
                spreads,
                result,
                index,
                values,
                invoke,
            });
        }
        Frame::Pull(iterator) => {
            let mut inner = iterator.borrow_mut(mc);
            match &mut *inner {
                IterableState::External { source, index } => {
                    if !source.require(mc, *index)? {
                        state.frames.push(Frame::Pull(iterator));
                    } else {
                        let item = source.prefix().get(*index).copied();
                        if item.is_some() {
                            *index += 1;
                        }
                        state.items.push(item);
                    }
                }
                IterableState::Deferred { value } => {
                    let source = globals::iterator(mc, *value)?;
                    *inner = IterableState::Delegate { source };
                    state.frames.push(Frame::Pull(source));
                }
                IterableState::Delegate { source } => state.frames.push(Frame::Pull(*source)),
                IterableState::Custom {
                    factory,
                    cursor,
                    done,
                    ..
                } => {
                    if *done {
                        state.items.push(None);
                    } else if let Some(cursor) = *cursor {
                        if let Value::Iterable(source) = cursor.raw() {
                            *inner = IterableState::Delegate { source };
                            state.frames.push(Frame::Pull(source));
                        } else {
                            let next = match cursor.raw() {
                                Value::Object(object) => {
                                    object.borrow().get("next").unwrap_or(Value::Undefined)
                                }
                                _ => {
                                    return Err(EvaluationError::Native(
                                        "iterator factory must return an iterator object".into(),
                                    ));
                                }
                            };
                            state.frames.push(Frame::CustomNext(iterator));
                            state.frames.push(Frame::Call(next, vec![]));
                        }
                    } else {
                        state.frames.push(Frame::CustomStarted(iterator));
                        state.frames.push(Frame::Call(*factory, vec![]));
                    }
                }
                IterableState::Source {
                    value,
                    index,
                    offset,
                } => {
                    let item = if let Value::String(text) = value.raw() {
                        text.code_point_at(*offset).map(|point| {
                            *offset += point.len();
                            value.carry_item(
                                mc,
                                Value::string(mc, RuntimeString::from_utf16(point.to_vec())),
                                *index,
                            )
                        })
                    } else {
                        globals::source_item(mc, *value, *index)
                    };
                    if item.is_some() {
                        *index += 1;
                    }
                    state.items.push(item);
                }
                IterableState::Map { source, .. }
                | IterableState::Filter { source, .. }
                | IterableState::Scan { source, .. }
                | IterableState::Enumerate { source, .. } => {
                    state.frames.push(Frame::Transform(iterator));
                    state.frames.push(Frame::Pull(*source));
                }
            }
        }
        Frame::CustomStarted(iterator) => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            let mut inner = iterator.borrow_mut(mc);
            let IterableState::Custom { cursor, .. } = &mut *inner else {
                return Err(EvaluationError::InvalidState);
            };
            *cursor = Some(value);
            state.frames.push(Frame::Pull(iterator));
        }
        Frame::CustomNext(iterator) => {
            let value = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            // Provenance wrappers are evaluator metadata; the protocol consumes
            // the completed raw iterator-result record.
            let (done_value, item) = match value.raw() {
                Value::Object(object) => {
                    let properties = object.borrow();
                    (
                        properties.get("done").unwrap_or(Value::Undefined),
                        properties.get("value").unwrap_or(Value::Undefined),
                    )
                }
                _ => {
                    return Err(EvaluationError::Native(
                        "iterator next must return an object".into(),
                    ));
                }
            };
            let mut inner = iterator.borrow_mut(mc);
            let IterableState::Custom {
                value: source,
                done,
                index,
                ..
            } = &mut *inner
            else {
                return Err(EvaluationError::InvalidState);
            };
            *done = truthy(done_value);
            if *done {
                state.items.push(None);
            } else {
                state.items.push(Some(source.carry_item(mc, item, *index)));
                *index += 1;
            }
        }
        Frame::Transform(iterator) => {
            let item = state.items.pop().ok_or(EvaluationError::InvalidState)?;
            if let Some(item) = item {
                let mut inner = iterator.borrow_mut(mc);
                match &mut *inner {
                    IterableState::Map { callback, .. }
                    | IterableState::Filter { callback, .. } => {
                        state.frames.push(Frame::Transformed { iterator, item });
                        state.frames.push(Frame::Call(*callback, vec![item]));
                    }
                    IterableState::Scan { callback, acc, .. } => {
                        state.frames.push(Frame::Transformed { iterator, item });
                        state.frames.push(Frame::Call(*callback, vec![*acc, item]));
                    }
                    IterableState::Enumerate { index, .. } => {
                        state.items.push(Some(Value::object(
                            mc,
                            vec![
                                ("index".into(), Value::Number(*index as f64)),
                                ("value".into(), item),
                            ],
                        )));
                        *index += 1;
                    }
                    _ => return Err(EvaluationError::InvalidState),
                }
            } else {
                state.items.push(None);
            }
        }
        Frame::Transformed { iterator, item } => {
            let output = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            let mut inner = iterator.borrow_mut(mc);
            match &mut *inner {
                IterableState::Map { .. } => state.items.push(Some(output)),
                IterableState::Filter { .. } => {
                    if truthy(output) {
                        state.items.push(Some(item));
                    } else {
                        state.frames.push(Frame::Pull(iterator));
                    }
                }
                IterableState::Scan { acc, .. } => {
                    *acc = output;
                    state.items.push(Some(output));
                }
                _ => return Err(EvaluationError::InvalidState),
            }
        }
        Frame::Drain { iterator, result } => {
            state.frames.push(Frame::Drained { iterator, result });
            state.frames.push(Frame::Pull(iterator));
        }
        Frame::Drained {
            iterator,
            mut result,
        } => match state.items.pop().ok_or(EvaluationError::InvalidState)? {
            Some(item) => {
                result.push(item);
                state.frames.push(Frame::Drain { iterator, result });
            }
            None => state.values.push(Value::array(mc, result)),
        },
        Frame::Reduce {
            iterator,
            callback,
            acc,
        } => {
            state.frames.push(Frame::ReduceItem {
                iterator,
                callback,
                acc,
            });
            state.frames.push(Frame::Pull(iterator));
        }
        Frame::ReduceItem {
            iterator,
            callback,
            acc,
        } => match state.items.pop().ok_or(EvaluationError::InvalidState)? {
            Some(item) => {
                state.frames.push(Frame::Reduced { iterator, callback });
                state.frames.push(Frame::Call(callback, vec![acc, item]));
            }
            None => state.values.push(acc),
        },
        Frame::Reduced { iterator, callback } => {
            let acc = state.values.pop().ok_or(EvaluationError::InvalidState)?;
            state.frames.push(Frame::Reduce {
                iterator,
                callback,
                acc,
            });
        }
        Frame::Parameters {
            mut execution,
            closure,
            subject,
        } => {
            execution.set_external(state.external);
            if !execution.step(mc).map_err(|error| match error {
                PatternError::Expression(error) => *error,
                other => EvaluationError::Pattern(other),
            })? {
                state.frames.push(Frame::Parameters {
                    execution,
                    closure,
                    subject,
                });
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
                    current_match: state.current_match,
                    subject: state.subject,
                });
                state.environment = matched.environment;
                state.origin = matched.origin;
                state.matched_value = matched.value;
                state.current_match = Some(matched);
                state.subject = subject;
                state.program = closure.program.clone();
                state.frames.push(Frame::Evaluate(closure.body));
            }
        }
        Frame::Restore {
            environment,
            program,
            origin,
            matched_value,
            current_match,
            subject,
        } => {
            state.environment = environment;
            state.program = program;
            state.origin = origin;
            state.matched_value = matched_value;
            state.current_match = current_match;
            state.subject = subject;
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

fn array_index(name: &RuntimeString) -> Option<usize> {
    let index = name.to_utf8().ok()?.parse::<u32>().ok()?;
    (index != u32::MAX && *name == index.to_string()).then_some(index as usize)
}

#[cfg(test)]
mod expression_ports;
#[cfg(test)]
mod tests;

//! Rule scheduling, invocation identity, and module execution.

pub mod input;

use crate::environment::Environment;
use crate::evaluate::{
    CompiledExpression, EvaluationError, ExpressionExecution, HostCompletion, HostDriver,
    HostExecution, HostRequest, RootedValue, StepStatus, is_stale_request,
};
use crate::expression::Expression;
use crate::module::{CompiledModuleGraph, ModuleBindings};
use crate::pattern::{
    FailureDiagnostic, MatchKind, Pattern, PatternArgument, PatternError, PatternExecution,
    PatternKind, PatternMatch, PatternProgram, PatternRequest, ResolveTargetKind, ResolveValue,
    SpecialBody,
};
use crate::resolver::graph::{MemberKind, ModuleMember};
use crate::value::{HostCallable, Value};
use input::{InputIdentity, InputPosition, RecoveryContext};
use std::collections::HashMap;
use std::fmt;
use std::future::Future;
use std::rc::Rc;
use uffda_heap::{Arena, Collect, DynamicRootSet, Gc, Mutation, RefLock, Rootable};
use url::Url;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RuntimeError {
    UnknownRule(String),
    NotRule(String),
    InvalidArguments(String),
    InvalidState,
    Pattern(PatternError),
    Expression(EvaluationError),
    Module(String),
    Decorator(String),
}

impl fmt::Display for RuntimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownRule(name) => write!(f, "unknown rule reference: {name}"),
            Self::NotRule(name) => write!(f, "expected rule, got callable: {name}"),
            Self::InvalidArguments(message) | Self::Module(message) | Self::Decorator(message) => {
                f.write_str(message)
            }
            Self::InvalidState => f.write_str("invalid rule execution state"),
            Self::Pattern(error) => error.fmt(f),
            Self::Expression(error) => write!(f, "rule expression exception: {error}"),
        }
    }
}

impl std::error::Error for RuntimeError {}

impl From<PatternError> for RuntimeError {
    fn from(value: PatternError) -> Self {
        Self::Pattern(value)
    }
}

impl From<EvaluationError> for RuntimeError {
    fn from(value: EvaluationError) -> Self {
        Self::Expression(value)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeErrorContext {
    pub member: ModuleMember,
    pub rule_name: String,
    pub entered_at: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DiagnosticKind {
    Recovery,
    Failure,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiagnosticRule {
    pub module_url: String,
    pub name: String,
    pub entered_at: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeDiagnostic {
    pub kind: DiagnosticKind,
    pub span: crate::provenance::Origin,
    pub focus_span: crate::provenance::Origin,
    pub position: Option<InputPosition>,
    pub unexpected: Option<String>,
    pub unexpected_span: Option<crate::provenance::Origin>,
    pub expected: Vec<String>,
    pub expected_values: Vec<String>,
    pub rules: Vec<DiagnosticRule>,
    pub explanation: Option<String>,
    pub message: String,
}

struct DiagnosticChain<'gc> {
    parent: Option<Rc<Self>>,
    declaration: Gc<'gc, DeclarationMetadata<'gc>>,
    entered_at: usize,
}

impl Drop for DiagnosticChain<'_> {
    fn drop(&mut self) {
        let mut parent = self.parent.take();
        while let Some(frame) = parent {
            match Rc::try_unwrap(frame) {
                Ok(mut frame) => parent = frame.parent.take(),
                Err(_) => break,
            }
        }
    }
}

struct DiagnosticNode<'gc> {
    matched: Gc<'gc, PatternMatch<'gc>>,
    absorbed: usize,
    depth: usize,
    chain: Option<Rc<DiagnosticChain<'gc>>>,
    parent: Option<usize>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct Context {
    #[collect(require_static)]
    module: Url,
    arguments: Vec<(String, usize)>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum TargetKey {
    Declared(ModuleMember, Vec<usize>),
    Inline((usize, usize), usize, usize),
}

#[derive(Collect)]
#[collect(no_drop)]
enum Target<'gc> {
    Declared {
        #[collect(require_static)]
        member: ModuleMember,
        context: Gc<'gc, Context>,
    },
    Inline {
        #[collect(require_static)]
        pattern: PatternArgument,
        environment: Environment<'gc>,
        context: Gc<'gc, Context>,
    },
    Special {
        #[collect(require_static)]
        pattern: Rc<PatternProgram>,
        environment: Environment<'gc>,
        context: Gc<'gc, Context>,
    },
}

impl<'gc> Target<'gc> {
    fn context(&self) -> Gc<'gc, Context> {
        match self {
            Self::Declared { context, .. }
            | Self::Inline { context, .. }
            | Self::Special { context, .. } => *context,
        }
    }
}

/// Non-rule declarations indexed by the closure environment and pattern program
/// that identify requests made from inside them. Values are declaration indexes;
/// the lowest matching index owns a request.
#[derive(Default)]
struct ContextOwners {
    environments: HashMap<usize, usize>,
    patterns: HashMap<usize, usize>,
}

impl ContextOwners {
    fn new<'gc>(
        graph: &CompiledModuleGraph,
        bindings: &ModuleBindings<'gc>,
        declarations: &[Gc<'gc, DeclarationMetadata<'gc>>],
    ) -> Result<Self, RuntimeError> {
        let mut owners = Self::default();
        for (index, declaration) in declarations.iter().enumerate() {
            if declaration.member.kind == MemberKind::Rule {
                continue;
            }
            if let Some(Value::Lambda(closure)) = bindings.callable(&declaration.member) {
                let module_environment = bindings
                    .environment(&declaration.member.module_url)
                    .ok_or(RuntimeError::InvalidState)?;
                if closure.environment.identity() != module_environment.identity() {
                    owners
                        .environments
                        .entry(closure.environment.identity())
                        .or_insert(index);
                }
            }
            let compiled = graph
                .declaration(&declaration.member)
                .ok_or(RuntimeError::InvalidState)?;
            owners
                .patterns
                .entry(Rc::as_ptr(&compiled.pattern) as usize)
                .or_insert(index);
        }
        Ok(owners)
    }

    fn owner(&self, environment: Environment<'_>, program_identity: usize) -> Option<usize> {
        environment
            .ancestors()
            .filter_map(|ancestor| self.environments.get(&ancestor.identity()).copied())
            .chain(self.patterns.get(&program_identity).copied())
            .min()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct MemoKey {
    target: usize,
    position: InputPosition,
    recovery: bool,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
struct Dependency {
    memo: usize,
    version: usize,
}

#[derive(Collect)]
#[collect(no_drop)]
enum MemoState<'gc> {
    Vacant,
    Pending,
    Growing(Gc<'gc, PatternMatch<'gc>>),
    Complete(Gc<'gc, PatternMatch<'gc>>),
}

#[derive(Collect)]
#[collect(no_drop)]
struct Memo<'gc> {
    input: InputIdentity<'gc>,
    stream: input::InputBuffer<'gc>,
    position: usize,
    state: MemoState<'gc>,
    version: usize,
    dependencies: Vec<Dependency>,
    seed_dependencies: Vec<Dependency>,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Execution<'gc> {
    Pattern(PatternExecution<'gc>),
    Expression(ExpressionExecution<'gc>),
    Metadata,
}

impl<'gc> Execution<'gc> {
    fn input_pending(&self) -> bool {
        match self {
            Self::Pattern(execution) => execution.input_pending(),
            Self::Expression(execution) => execution.input_pending(),
            Self::Metadata => false,
        }
    }

    fn take_input_request(&mut self, mc: &Mutation<'gc>) -> Option<input::InputRequest> {
        match self {
            Self::Pattern(execution) => execution.take_input_request(mc),
            Self::Expression(execution) => execution.take_input_request(mc),
            Self::Metadata => None,
        }
    }

    fn complete_input(
        &mut self,
        mc: &Mutation<'gc>,
        request: &input::InputRequest,
        completion: Result<input::InputCompletion, String>,
    ) -> Result<(), RuntimeError> {
        match self {
            Self::Pattern(execution) => Ok(execution.complete_input(mc, request, completion)?),
            Self::Expression(execution) => Ok(execution.complete_input(mc, request, completion)?),
            Self::Metadata => Err(RuntimeError::InvalidState),
        }
    }

    fn set_external(&mut self, external: DynamicRootSet<'gc>) {
        match self {
            Self::Pattern(execution) => execution.set_external(external),
            Self::Expression(execution) => execution.set_external(external),
            Self::Metadata => {}
        }
    }

    fn host_pending(&self) -> bool {
        match self {
            Self::Pattern(execution) => execution.host_pending(),
            Self::Expression(execution) => execution.host_pending(),
            Self::Metadata => false,
        }
    }

    fn take_host_request(&mut self, mc: &Mutation<'gc>) -> Option<HostRequest> {
        match self {
            Self::Pattern(execution) => execution.take_host_request(mc),
            Self::Expression(execution) => execution.take_host_request(mc),
            Self::Metadata => None,
        }
    }

    fn complete_host(
        &mut self,
        mc: &Mutation<'gc>,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), RuntimeError> {
        match self {
            Self::Pattern(execution) => Ok(execution.complete_host(mc, request, completion)?),
            Self::Expression(execution) => Ok(execution.complete_host(mc, request, completion)?),
            Self::Metadata => Err(RuntimeError::InvalidState),
        }
    }

    fn request(&self) -> Option<PatternRequest<'gc>> {
        match self {
            Self::Pattern(execution) => execution.take_request(),
            Self::Expression(execution) => execution.take_request(),
            Self::Metadata => None,
        }
    }

    fn resume(
        &mut self,
        mc: &Mutation<'gc>,
        outcome: Gc<'gc, PatternMatch<'gc>>,
    ) -> Result<(), RuntimeError> {
        match self {
            Self::Pattern(execution) => execution.resume_resolve(mc, outcome)?,
            Self::Expression(execution) => execution.resume_resolve(mc, outcome)?,
            Self::Metadata => return Err(RuntimeError::InvalidState),
        }
        Ok(())
    }

    fn step(&mut self, mc: &Mutation<'gc>) -> Result<bool, RuntimeError> {
        match self {
            Self::Pattern(execution) => Ok(execution.step(mc)?),
            Self::Expression(execution) => Ok(execution.step(mc)?),
            Self::Metadata => Ok(true),
        }
    }
}

#[derive(Collect)]
#[collect(no_drop)]
struct Frame<'gc> {
    execution: Execution<'gc>,
    context: Gc<'gc, Context>,
    lexical_environment: Environment<'gc>,
    invocation: Option<Invocation<'gc>>,
    completion: Completion,
}

#[derive(Clone, Copy, Collect)]
#[collect(require_static)]
enum Completion {
    Root,
    Rule,
    AttributeArgument,
    Decorator,
    Serialization,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct ResolvedAttribute<'gc> {
    #[collect(require_static)]
    pub decorator: ModuleMember,
    pub arguments: Vec<Value<'gc>>,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct DeclarationMetadata<'gc> {
    #[collect(require_static)]
    pub member: ModuleMember,
    pub subject: Value<'gc>,
    pub attributes: Gc<'gc, RefLock<Vec<ResolvedAttribute<'gc>>>>,
    pub metadata: Value<'gc>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct Initialization<'gc> {
    declaration: usize,
    attribute: usize,
    arguments: Vec<Value<'gc>>,
    #[collect(require_static)]
    decorator: Option<ModuleMember>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct Entry<'gc> {
    context: Gc<'gc, Context>,
    environment: Environment<'gc>,
    input: Vec<Value<'gc>>,
    #[collect(require_static)]
    input_mode: Option<InputMode>,
    source: Option<input::InputSource<'gc>>,
    #[collect(require_static)]
    export: Option<String>,
    target_kind: ResolveTargetKind,
    #[collect(require_static)]
    pattern: Option<Rc<PatternProgram>>,
    recovery: RecoveryContext<'gc>,
    /// The root input is an open prefix, also when it is restarted with recovery.
    #[collect(require_static)]
    open: bool,
}

#[derive(Collect)]
#[collect(no_drop)]
struct Invocation<'gc> {
    request: PatternRequest<'gc>,
    target: usize,
    /// `None` when this rule's invocation skips packrat memo bookkeeping
    /// (selective memoization). Active-position tracking still uses
    /// [`ActiveMark`] with `memo: None` for eviction low-water marks.
    memo: Option<usize>,
    pattern_match: Option<Gc<'gc, PatternMatch<'gc>>>,
    growing: bool,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
struct ActiveMark {
    /// Index into `memos`, or `None` for a skip-memo (unmemoized) frame.
    memo: Option<usize>,
    domain: Option<usize>,
    low: Option<usize>,
}

/// An explicit rule stack. Every suspended pattern, expression, closure,
/// stream, seed and memoized value remains reachable from this collector root.
#[derive(Collect)]
#[collect(no_drop)]
pub struct RuleExecution<'gc> {
    #[collect(require_static)]
    graph: Option<Rc<CompiledModuleGraph>>,
    bindings: Option<ModuleBindings<'gc>>,
    targets: Vec<Target<'gc>>,
    #[collect(require_static)]
    target_keys: HashMap<TargetKey, usize>,
    memos: Vec<Memo<'gc>>,
    #[collect(require_static)]
    memo_keys: HashMap<MemoKey, usize>,
    active_marks: Vec<ActiveMark>,
    frames: Vec<Frame<'gc>>,
    result: Option<Gc<'gc, PatternMatch<'gc>>>,
    #[collect(require_static)]
    error: Option<RuntimeError>,
    #[collect(require_static)]
    error_context: Option<RuntimeErrorContext>,
    memo_hits: usize,
    body_attempts: usize,
    declarations: Vec<Gc<'gc, DeclarationMetadata<'gc>>>,
    #[collect(require_static)]
    context_owners: ContextOwners,
    initialization: Option<Initialization<'gc>>,
    entry: Entry<'gc>,
    serialized: Option<Value<'gc>>,
    external: DynamicRootSet<'gc>,
}

impl<'gc> RuleExecution<'gc> {
    pub fn for_pattern(mc: &Mutation<'gc>, pattern: Pattern, input: Vec<Value<'gc>>) -> Self {
        let environment = Environment::new(mc, None, vec![]);
        let context = Gc::new(
            mc,
            Context {
                module: Url::parse("uffda:pattern").expect("static neutral scope URI"),
                arguments: vec![],
            },
        );
        let recovery = RecoveryContext::new(mc);
        let pattern = PatternProgram::compile(pattern);
        let execution = PatternExecution::compiled_with_recovery(
            mc,
            pattern.clone(),
            input.clone(),
            environment,
            0,
            recovery,
        );
        Self {
            graph: None,
            bindings: None,
            targets: vec![],
            target_keys: HashMap::new(),
            memos: vec![],
            memo_keys: HashMap::new(),
            active_marks: vec![],
            frames: vec![Frame {
                execution: Execution::Pattern(execution),
                context,
                lexical_environment: environment,
                invocation: None,
                completion: Completion::Root,
            }],
            result: None,
            error: None,
            error_context: None,
            memo_hits: 0,
            body_attempts: 0,
            declarations: vec![],
            context_owners: ContextOwners::default(),
            initialization: None,
            entry: Entry {
                context,
                environment,
                input,
                input_mode: Some(InputMode::Scalar),
                source: None,
                export: None,
                target_kind: ResolveTargetKind::Run,
                pattern: Some(pattern),
                recovery,
                open: false,
            },
            serialized: None,
            external: DynamicRootSet::new(mc),
        }
    }
    pub fn new(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: Vec<Value<'gc>>,
    ) -> Result<Self, RuntimeError> {
        Self::build(mc, graph, module, export, input, false)
    }

    /// Module environments inherit this explicit host environment; module
    /// declarations retain their ordinary lexical shadowing precedence.
    pub fn with_environment(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
    ) -> Result<Self, RuntimeError> {
        Self::build_with_environment(mc, graph, module, export, input, false, Some(environment))
    }

    pub fn metadata(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
    ) -> Result<Self, RuntimeError> {
        let module = graph.graph.entry.clone();
        Self::build(mc, graph, &module, None, vec![], true)
    }

    pub fn for_member(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: Vec<Value<'gc>>,
    ) -> Result<Self, RuntimeError> {
        let bindings =
            ModuleBindings::with_environment(mc, &graph, None).map_err(RuntimeError::Module)?;
        Self::for_member_with_bindings(mc, graph, bindings, member, input)
    }

    /// Builds a rule invocation that reuses already-materialized module bindings.
    pub fn for_member_with_bindings(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        bindings: ModuleBindings<'gc>,
        member: &ModuleMember,
        input: Vec<Value<'gc>>,
    ) -> Result<Self, RuntimeError> {
        let declaration = graph
            .declaration(member)
            .ok_or(RuntimeError::InvalidState)?;
        if member.kind != MemberKind::Rule {
            return Err(RuntimeError::NotRule(declaration.name.clone()));
        }
        let name = declaration.name.clone();
        let mut execution = Self::build_with_bindings(
            mc,
            graph,
            bindings,
            &member.module_url,
            None,
            input.clone(),
            true,
        )?;
        execution.entry.target_kind = ResolveTargetKind::Reference;
        execution.entry.export.replace(name.clone());
        execution.frames[0].execution = Execution::Pattern(PatternExecution::new_with_recovery(
            mc,
            Pattern::Resolve {
                target_kind: ResolveTargetKind::Reference,
                name: Some(name),
                args: vec![],
                value: None,
            },
            input,
            execution.entry.environment,
            execution.entry.recovery,
        ));
        Ok(execution)
    }

    /// Treats the root input as open (see `PatternExecution::set_open`). Only
    /// meaningful before the first step.
    pub fn set_open_input(&mut self) {
        self.entry.open = true;
        if let Some(Frame {
            execution: Execution::Pattern(pattern),
            ..
        }) = self.frames.first_mut()
        {
            pattern.set_open();
        }
    }

    /// Returns the warm module bindings after clearing match/memo state so the
    /// match tree can be collected while bindings stay rooted elsewhere.
    pub fn take_bindings_after_run(&mut self) -> Option<ModuleBindings<'gc>> {
        self.frames.clear();
        self.active_marks.clear();
        self.memos.clear();
        self.memo_keys.clear();
        self.targets.clear();
        self.target_keys.clear();
        self.result = None;
        self.serialized = None;
        self.error = None;
        self.error_context = None;
        self.initialization = None;
        self.declarations.clear();
        self.bindings.take()
    }

    fn build(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: Vec<Value<'gc>>,
        metadata_only: bool,
    ) -> Result<Self, RuntimeError> {
        Self::build_with_environment(mc, graph, module, export, input, metadata_only, None)
    }

    fn build_with_environment(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: Vec<Value<'gc>>,
        metadata_only: bool,
        parent: Option<Environment<'gc>>,
    ) -> Result<Self, RuntimeError> {
        let bindings =
            ModuleBindings::with_environment(mc, &graph, parent).map_err(RuntimeError::Module)?;
        Self::build_with_bindings(mc, graph, bindings, module, export, input, metadata_only)
    }

    fn build_with_bindings(
        mc: &Mutation<'gc>,
        graph: Rc<CompiledModuleGraph>,
        bindings: ModuleBindings<'gc>,
        module: &Url,
        export: Option<&str>,
        input: Vec<Value<'gc>>,
        metadata_only: bool,
    ) -> Result<Self, RuntimeError> {
        if !metadata_only {
            let member = graph
                .export(module, export)
                .ok_or_else(|| RuntimeError::UnknownRule(export.unwrap_or("default").into()))?;
            if member.kind != MemberKind::Rule {
                return Err(RuntimeError::NotRule(export.unwrap_or("default").into()));
            }
        }
        let environment = bindings
            .environment(module)
            .ok_or(RuntimeError::InvalidState)?;
        let context = Gc::new(
            mc,
            Context {
                module: module.clone(),
                arguments: vec![],
            },
        );
        let mut members = Vec::new();
        let mut modules: Vec<_> = graph.graph.modules.iter().collect();
        modules.sort_by(|(left, _), (right, _)| left.as_str().cmp(right.as_str()));
        for (module_url, module) in modules {
            for (kind, count) in [
                (MemberKind::Rule, module.declaration.rules.len()),
                (MemberKind::Func, module.declaration.funcs.len()),
                (MemberKind::Decorator, module.declaration.decorators.len()),
            ] {
                for declaration_index in 0..count {
                    members.push(ModuleMember {
                        module_url: module_url.clone(),
                        kind,
                        declaration_index,
                    });
                }
            }
        }
        let declarations = members
            .into_iter()
            .map(|member| {
                let subject = bindings
                    .declaration(&member)
                    .ok_or(RuntimeError::InvalidState)?;
                Ok(Gc::new(
                    mc,
                    DeclarationMetadata {
                        member,
                        subject,
                        attributes: Gc::new(mc, RefLock::new(vec![])),
                        metadata: Value::object(mc, vec![]),
                    },
                ))
            })
            .collect::<Result<Vec<_>, RuntimeError>>()?;
        let context_owners = ContextOwners::new(&graph, &bindings, &declarations)?;
        let recovery = RecoveryContext::new(mc);
        let retained_input = input.clone();
        let execution = if metadata_only {
            Execution::Metadata
        } else {
            Execution::Pattern(PatternExecution::new_with_recovery(
                mc,
                Pattern::Resolve {
                    target_kind: ResolveTargetKind::Run,
                    name: export.map(str::to_owned),
                    args: vec![],
                    value: None,
                },
                input,
                environment,
                recovery,
            ))
        };
        Ok(Self {
            graph: Some(graph),
            bindings: Some(bindings),
            targets: vec![],
            target_keys: HashMap::new(),
            memos: vec![],
            memo_keys: HashMap::new(),
            active_marks: vec![],
            frames: vec![Frame {
                execution,
                context,
                lexical_environment: environment,
                invocation: None,
                completion: Completion::Root,
            }],
            result: None,
            error: None,
            error_context: None,
            memo_hits: 0,
            body_attempts: 0,
            context_owners,
            declarations,
            initialization: Some(Initialization {
                declaration: 0,
                attribute: 0,
                arguments: vec![],
                decorator: None,
            }),
            entry: Entry {
                context,
                environment,
                input: retained_input,
                input_mode: Some(InputMode::Scalar),
                source: None,
                export: export.map(str::to_owned),
                target_kind: ResolveTargetKind::Run,
                pattern: None,
                recovery,
                open: false,
            },
            serialized: None,
            external: DynamicRootSet::new(mc),
        })
    }

    pub fn result(&self) -> Option<Gc<'gc, PatternMatch<'gc>>> {
        self.result
    }

    fn reparse_edit(
        &mut self,
        mc: &Mutation<'gc>,
        post_edit: impl Into<crate::json::JsonValue>,
        mode: InputMode,
        at: usize,
        removed: usize,
        inserted: usize,
    ) -> Result<(), RuntimeError> {
        if !self.frames.is_empty()
            || self.result.is_none()
            || self.error.is_some()
            || self.entry.source.is_some()
            || self.entry.input_mode != Some(mode)
        {
            return Err(RuntimeError::InvalidState);
        }

        let old_len = self.entry.input.len();
        if at > old_len || removed > old_len - at {
            return Err(RuntimeError::InvalidArguments(
                "edit range is outside the prior input".into(),
            ));
        }
        let mut supplied = runtime_input(mc, post_edit, mode)?;
        if (old_len - removed).checked_add(inserted) != Some(supplied.len()) {
            return Err(RuntimeError::InvalidArguments(
                "edit counts do not match the post-edit input length".into(),
            ));
        }

        let prefix_matches = self.entry.input[..at]
            .iter()
            .zip(&supplied[..at])
            .all(|(old, new)| same_input_item(*old, *new));
        let can_reuse = prefix_matches && !self.entry.recovery.was_reached();
        if prefix_matches {
            let mut input = self.entry.input[..at].to_vec();
            input.extend_from_slice(&supplied[at..]);
            supplied = input;
        }

        let recovery = RecoveryContext::new(mc);
        let pattern = match &self.entry.pattern {
            Some(program) => PatternExecution::compiled_with_recovery(
                mc,
                program.clone(),
                supplied.clone(),
                self.entry.environment,
                0,
                recovery,
            ),
            None => PatternExecution::new_with_recovery(
                mc,
                Pattern::Resolve {
                    target_kind: self.entry.target_kind,
                    name: self.entry.export.clone(),
                    args: vec![],
                    value: None,
                },
                supplied.clone(),
                self.entry.environment,
                recovery,
            ),
        };
        let (identity, stream) = pattern.root_input().ok_or(RuntimeError::InvalidState)?;

        self.memos.clear();
        self.memo_keys.clear();
        if can_reuse && at > 0 {
            let prior = self.result.ok_or(RuntimeError::InvalidState)?;
            self.rehydrate_memos(mc, prior, at, identity, stream, recovery);
        }

        self.entry.input = supplied;
        self.entry.recovery = recovery;
        self.result = None;
        self.error = None;
        self.error_context = None;
        self.serialized = None;
        self.memo_hits = 0;
        self.body_attempts = 0;
        self.frames.push(Frame {
            execution: Execution::Pattern(pattern),
            context: self.entry.context,
            lexical_environment: self.entry.environment,
            invocation: None,
            completion: Completion::Root,
        });
        Ok(())
    }

    fn rehydrate_memos(
        &mut self,
        mc: &Mutation<'gc>,
        root: Gc<'gc, PatternMatch<'gc>>,
        at: usize,
        identity: InputIdentity<'gc>,
        stream: input::InputBuffer<'gc>,
        recovery: RecoveryContext<'gc>,
    ) {
        let old_domain = root.identity.position(0).domain;
        let mut nodes = Vec::new();
        let mut parents = HashMap::<usize, Vec<usize>>::new();
        let mut seen = std::collections::HashSet::new();
        let mut pending = vec![root];
        while let Some(node) = pending.pop() {
            let address = Gc::as_ptr(node) as usize;
            if !seen.insert(address) {
                continue;
            }
            nodes.push(node);
            for child in &node.children {
                parents
                    .entry(Gc::as_ptr(*child) as usize)
                    .or_default()
                    .push(address);
                pending.push(*child);
            }
        }

        let mut invalid = std::collections::HashSet::new();
        let mut pending: Vec<usize> = nodes
            .iter()
            .filter(|node| {
                let position = node.identity.position(node.start);
                let before_edit = if position.path.is_empty() {
                    node.start < at && node.end <= at
                } else {
                    matches!(position.path.first(), Some(input::PathSegment::Item(item)) if *item < at)
                };
                node.seeded
                    || node.recovered
                    || position.domain != old_domain
                    || !before_edit
            })
            .map(|node| Gc::as_ptr(*node) as usize)
            .collect();
        while let Some(address) = pending.pop() {
            if !invalid.insert(address) {
                continue;
            }
            pending.extend(parents.get(&address).into_iter().flatten().copied());
        }

        // Consumed spans alone cannot prove reuse: lookahead, rejected branches,
        // and repetition terminators can inspect input past a parent's end.
        let mut pending = vec![root];
        let mut seen = std::collections::HashSet::new();
        while let Some(node) = pending.pop() {
            let address = Gc::as_ptr(node) as usize;
            if !seen.insert(address) {
                continue;
            }
            let mut capture = || {
                let position = node.identity.position(node.start);
                if invalid.contains(&address)
                    || !matches!(node.kind, MatchKind::Ok | MatchKind::Fail)
                    || node.start >= at
                    || node.end > at
                    || position.domain != old_domain
                    || !position.path.is_empty()
                {
                    return false;
                }
                let (Some(rule), Some(arguments)) = (node.rule, node.rule_arguments()) else {
                    return false;
                };
                if self
                    .graph
                    .as_ref()
                    .is_some_and(|graph| graph.can_skip_memo(&rule.member))
                {
                    // Skip-memo rules never consult the memo table; an entry
                    // would never be looked up. Keep walking for descendants.
                    return false;
                }
                let key = TargetKey::Declared(rule.member.clone(), arguments.to_vec());
                let Some(target) = self.target_keys.get(&key).copied() else {
                    return false;
                };
                let memo_key = MemoKey {
                    target,
                    position: identity.position(node.start),
                    recovery: node.recovery.is_enabled(),
                };
                if self.memo_keys.contains_key(&memo_key) {
                    return true;
                }
                let outcome =
                    PatternMatch::with_rebased_input(mc, node, identity, stream, recovery);
                let memo = self.memos.len();
                self.memos.push(Memo {
                    input: identity,
                    stream,
                    position: node.start,
                    state: MemoState::Complete(outcome),
                    version: 0,
                    dependencies: vec![],
                    seed_dependencies: vec![],
                });
                self.memo_keys.insert(memo_key, memo);
                true
            };
            if !capture() {
                pending.extend(node.children.iter().rev().copied());
            }
        }
    }

    pub fn error(&self) -> Option<&RuntimeError> {
        self.error.as_ref()
    }

    pub fn error_context(&self) -> Option<&RuntimeErrorContext> {
        self.error_context.as_ref()
    }

    pub fn begin_serialize_result(&mut self, mc: &Mutation<'gc>) -> Result<(), RuntimeError> {
        let result = self.result.ok_or(RuntimeError::InvalidState)?;
        self.begin_serialize(mc, result.value, result.environment, result.origin)
    }

    pub fn begin_serialize_metadata(
        &mut self,
        mc: &Mutation<'gc>,
        member: &ModuleMember,
    ) -> Result<(), RuntimeError> {
        let value = self
            .declarations
            .iter()
            .find(|record| &record.member == member)
            .ok_or(RuntimeError::InvalidState)?
            .metadata;
        self.begin_serialize(
            mc,
            value,
            self.bindings
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .environment(&member.module_url)
                .ok_or(RuntimeError::InvalidState)?,
            crate::provenance::Origin { start: 0, end: 0 },
        )
    }

    fn begin_serialize(
        &mut self,
        mc: &Mutation<'gc>,
        value: Value<'gc>,
        environment: Environment<'gc>,
        origin: crate::provenance::Origin,
    ) -> Result<(), RuntimeError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        if !self.frames.is_empty() || self.initialization.is_some() {
            return Err(RuntimeError::InvalidState);
        }
        let mut execution = ExpressionExecution::serialize(mc, value, environment, origin);
        if let Some(result) = self.result {
            execution.set_match(result);
        }
        execution.set_recovery(self.entry.recovery);
        self.serialized = None;
        self.frames.push(Frame {
            execution: Execution::Expression(execution),
            context: self.entry.context,
            lexical_environment: environment,
            invocation: None,
            completion: Completion::Serialization,
        });
        Ok(())
    }

    pub fn serialized_json(&self) -> Result<Option<String>, RuntimeError> {
        match self.serialized.ok_or(RuntimeError::InvalidState)?.raw() {
            Value::String(text) => Ok(Some(
                text.to_utf8()
                    .map_err(|e| RuntimeError::Module(e.to_string()))?,
            )),
            Value::Undefined => Ok(None),
            _ => Err(RuntimeError::InvalidState),
        }
    }

    pub fn memo_hits(&self) -> usize {
        self.memo_hits
    }

    pub fn body_attempts(&self) -> usize {
        self.body_attempts
    }

    pub fn is_clean(&self) -> bool {
        self.result
            .is_some_and(|result| result.kind != MatchKind::Fail && !result.recovered)
    }

    pub fn recoveries(&self) -> Vec<Gc<'gc, PatternMatch<'gc>>> {
        let Some(root) = self.result else {
            return vec![];
        };
        let mut pending = vec![root];
        let mut seen = std::collections::HashSet::new();
        let mut recoveries = Vec::new();
        while let Some(node) = pending.pop() {
            if !seen.insert(Gc::as_ptr(node) as usize) {
                continue;
            }
            if node.kind != MatchKind::Fail
                && node.recovered
                && node.is_recovery_node()
                && node
                    .children
                    .first()
                    .is_some_and(|child| child.kind == MatchKind::Fail)
            {
                recoveries.push(node);
            }
            pending.extend(
                node.children
                    .iter()
                    .rev()
                    .filter(|child| node.kind == MatchKind::Fail || child.recovered)
                    .copied(),
            );
        }
        recoveries.sort_by_key(|matched| (matched.origin.start, matched.origin.end));
        recoveries
    }

    pub fn failure_diagnostic(&self) -> Option<FailureDiagnostic> {
        self.failure_match().map(|matched| FailureDiagnostic {
            kind: matched.pattern_kind,
            position: matched.origin.start,
        })
    }

    pub fn diagnostics(&self) -> Vec<RuntimeDiagnostic> {
        self.diagnostics_with(|_| None)
    }

    /// Explanation policy belongs to the host; the callback can inspect the
    /// canonical rule metadata while it remains rooted in this execution.
    pub fn diagnostics_with(
        &self,
        explain: impl Fn(&DeclarationMetadata<'gc>) -> Option<String>,
    ) -> Vec<RuntimeDiagnostic> {
        let mut diagnostics = Vec::new();
        if let Some(root) = self.result {
            let mut pending = vec![(root, None, None)];
            let mut seen = std::collections::HashSet::new();
            while let Some((node, preceding, inherited)) = pending.pop() {
                if !seen.insert(Gc::as_ptr(node) as usize) {
                    continue;
                }
                let chain = diagnostic_chain(node, inherited);
                if node.kind != MatchKind::Fail
                    && node.recovered
                    && node.is_recovery_node()
                    && let Some(failure) = node
                        .children
                        .first()
                        .filter(|child| child.kind == MatchKind::Fail)
                {
                    let before = preceding
                        .map(|(parent, count): (Gc<'gc, PatternMatch<'gc>>, usize)| {
                            parent.children[..count].to_vec()
                        })
                        .unwrap_or_default();
                    if let Some(diagnostic) = analyze_diagnostic(
                        *failure,
                        &before,
                        chain.clone(),
                        DiagnosticKind::Recovery,
                        node.origin,
                        &explain,
                    ) {
                        diagnostics.push(diagnostic);
                    }
                }
                for (index, child) in node.children.iter().enumerate().rev() {
                    if node.kind == MatchKind::Fail || child.recovered {
                        pending.push((
                            *child,
                            if index == 0 {
                                preceding
                            } else {
                                Some((node, index))
                            },
                            chain.clone(),
                        ));
                    }
                }
            }
            diagnostics.sort_by_key(|diagnostic| (diagnostic.span.start, diagnostic.span.end));
            if root.kind == MatchKind::Fail
                && let Some(diagnostic) = analyze_diagnostic(
                    root,
                    &[],
                    None,
                    DiagnosticKind::Failure,
                    root.origin,
                    &explain,
                )
            {
                diagnostics.push(diagnostic);
            }
        }
        if let Some(error) = &self.error {
            let offset = self
                .error_context
                .as_ref()
                .map_or(0, |context| context.entered_at);
            let point = crate::provenance::Origin {
                start: offset,
                end: offset,
            };
            diagnostics.push(RuntimeDiagnostic {
                kind: DiagnosticKind::Error,
                span: point,
                focus_span: point,
                position: None,
                unexpected: None,
                unexpected_span: None,
                expected: vec![],
                expected_values: vec![],
                rules: self
                    .error_context
                    .as_ref()
                    .map(|context| DiagnosticRule {
                        module_url: context.member.module_url.to_string(),
                        name: context.rule_name.clone(),
                        entered_at: offset,
                    })
                    .into_iter()
                    .collect(),
                explanation: None,
                message: error.to_string(),
            });
        }
        diagnostics
    }

    pub fn rightmost_failure(&self) -> Option<FailureDiagnostic> {
        self.failure_diagnostic()
    }

    pub fn failure_match(&self) -> Option<Gc<'gc, PatternMatch<'gc>>> {
        let root = self.result?;
        if root.kind != MatchKind::Fail {
            return None;
        }
        let mut pending = vec![(root, 0usize, 0usize)];
        let mut visited = HashMap::new();
        let mut best: Option<(Gc<'gc, PatternMatch<'gc>>, usize, usize)> = None;
        while let Some((node, absorbed, depth)) = pending.pop() {
            let identity = Gc::as_ptr(node) as usize;
            if visited
                .get(&identity)
                .is_some_and(|standing| *standing <= (absorbed, depth))
            {
                continue;
            }
            visited.insert(identity, (absorbed, depth));
            if node.kind == MatchKind::Fail && !node.seeded {
                let better = best.is_none_or(|(candidate, candidate_absorbed, candidate_depth)| {
                    let path_order = node.identity.position(node.start).diagnostic_path().cmp(
                        &candidate
                            .identity
                            .position(candidate.start)
                            .diagnostic_path(),
                    );
                    node.origin.start > candidate.origin.start
                        || (node.origin.start == candidate.origin.start
                            && (path_order.is_gt()
                                || (path_order.is_eq()
                                    && (absorbed, depth) < (candidate_absorbed, candidate_depth))))
                });
                if better {
                    best = Some((node, absorbed, depth));
                }
            }
            let successes = absorbed + usize::from(node.kind != MatchKind::Fail);
            match node.pattern_kind {
                PatternKind::Not | PatternKind::Except => {}
                PatternKind::Lookahead if node.kind != MatchKind::Fail => {}
                PatternKind::Pipeline if node.kind != MatchKind::Fail => {}
                PatternKind::Pipeline => {
                    if let Some(child) = node.children.last() {
                        pending.push((*child, successes, depth + 1));
                    }
                }
                _ => pending.extend(
                    node.children
                        .iter()
                        .rev()
                        .map(|child| (*child, successes, depth + 1)),
                ),
            }
        }
        best.map(|(matched, _, _)| matched)
    }

    pub fn declarations(&self) -> &[Gc<'gc, DeclarationMetadata<'gc>>] {
        &self.declarations
    }

    pub fn origin(
        &self,
        matched: Gc<'gc, PatternMatch<'gc>>,
    ) -> Option<Gc<'gc, DeclarationMetadata<'gc>>> {
        matched.rule
    }

    /// Resolves one path rather than merging metadata attached through
    /// different ancestors of a shared, memoized subtree.
    pub fn metadata_path(&self, path: &[usize]) -> Option<Vec<Gc<'gc, DeclarationMetadata<'gc>>>> {
        let mut matched = self.result?;
        let mut result = Vec::new();
        if let Some(origin) = self.origin(matched) {
            result.push(origin);
        }
        for index in path {
            matched = *matched.children.get(*index)?;
            if let Some(origin) = self.origin(matched) {
                result.push(origin);
            }
        }
        Some(result)
    }

    pub fn step(&mut self, mc: &Mutation<'gc>) -> Result<bool, RuntimeError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let result = self.advance(mc);
        if let Err(error) = &result {
            self.fail(error.clone());
        }
        result
    }

    fn fail(&mut self, error: RuntimeError) {
        self.error_context = self.frames.iter().rev().find_map(|frame| {
            let invocation = frame.invocation.as_ref()?;
            let Target::Declared { member, .. } = &self.targets[invocation.target] else {
                return None;
            };
            let declaration = self.graph.as_ref()?.declaration(member)?;
            Some(RuntimeErrorContext {
                member: member.clone(),
                rule_name: declaration.name.clone(),
                entered_at: invocation
                    .request
                    .stream
                    .get(invocation.request.position)
                    .and_then(|value| value.origin())
                    .map(|origin| origin.start)
                    .or_else(|| {
                        invocation
                            .request
                            .stream
                            .last()
                            .and_then(|value| value.origin())
                            .map(|origin| origin.end)
                    })
                    .unwrap_or(invocation.request.base),
            })
        });
        self.frames.clear();
        self.active_marks.clear();
        self.memos.clear();
        self.memo_keys.clear();
        self.initialization = None;
        self.serialized = None;
        self.error = Some(error);
    }

    pub fn cancel(&mut self) {
        if self.error.is_none() {
            self.fail(EvaluationError::Cancelled.into());
            self.memos.clear();
            self.memo_keys.clear();
            self.result = None;
            self.entry.source = None;
        }
    }

    pub fn host_pending(&self) -> bool {
        self.frames
            .last()
            .is_some_and(|frame| frame.execution.host_pending())
    }

    pub fn take_host_request(&mut self, mc: &Mutation<'gc>) -> Option<HostRequest> {
        self.frames.last_mut()?.execution.take_host_request(mc)
    }

    pub fn input_pending(&self) -> bool {
        self.frames
            .last()
            .is_some_and(|frame| frame.execution.input_pending())
    }

    pub fn take_input_request(&mut self, mc: &Mutation<'gc>) -> Option<input::InputRequest> {
        self.frames.last_mut()?.execution.take_input_request(mc)
    }

    pub fn complete_input(
        &mut self,
        mc: &Mutation<'gc>,
        request: &input::InputRequest,
        completion: Result<input::InputCompletion, String>,
    ) -> Result<(), RuntimeError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = match self.frames.last_mut() {
            Some(frame) if frame.execution.input_pending() => {
                frame.execution.complete_input(mc, request, completion)
            }
            _ => Err(EvaluationError::StaleInputRequest.into()),
        };
        if let Err(error) = &outcome
            && !runtime_stale_request(error)
        {
            self.fail(error.clone());
        }
        outcome
    }

    pub fn fetch_rooted(&self, root: &RootedValue) -> Result<Value<'gc>, EvaluationError> {
        root.fetch(self.external)
    }

    pub fn complete_host(
        &mut self,
        mc: &Mutation<'gc>,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), RuntimeError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = match self.frames.last_mut() {
            Some(frame) if frame.execution.host_pending() => {
                frame.execution.complete_host(mc, request, completion)
            }
            _ => Err(EvaluationError::StaleHostRequest.into()),
        };
        if let Err(error) = &outcome
            && !runtime_stale_request(error)
        {
            self.fail(error.clone());
        }
        outcome
    }

    pub fn step_status(&mut self, mc: &Mutation<'gc>) -> Result<StepStatus, RuntimeError> {
        if self.step(mc)? {
            Ok(StepStatus::Complete)
        } else if self.host_pending() || self.input_pending() {
            Ok(StepStatus::Suspended)
        } else {
            Ok(StepStatus::Yielded)
        }
    }

    pub(crate) fn run_batch(
        &mut self,
        mc: &Mutation<'gc>,
        limit: usize,
    ) -> Result<(StepStatus, usize), RuntimeError> {
        for steps in 1..=limit {
            let status = self.step_status(mc)?;
            if status != StepStatus::Yielded {
                return Ok((status, steps));
            }
        }
        Ok((StepStatus::Yielded, limit))
    }

    fn advance(&mut self, mc: &Mutation<'gc>) -> Result<bool, RuntimeError> {
        if self.host_pending() || self.input_pending() {
            return Ok(false);
        }
        if self.frames.len() == 1 && self.initialization.is_some() {
            self.initialize_attribute(mc)?;
            return Ok(false);
        }
        let Some(frame) = self.frames.last() else {
            return Ok(true);
        };
        if let Some(request) = frame.execution.request() {
            let context = self.request_context(mc, &request)?;
            let target = self.resolve_request(mc, &request, context)?;
            self.invoke(mc, request, target)?;
            return Ok(false);
        }
        let frame = self.frames.last_mut().ok_or(RuntimeError::InvalidState)?;
        frame.execution.set_external(self.external);
        if !frame.execution.step(mc)? {
            return Ok(false);
        }
        self.finish_frame(mc)?;
        Ok(self.frames.is_empty())
    }

    fn initialize_attribute(&mut self, mc: &Mutation<'gc>) -> Result<(), RuntimeError> {
        loop {
            let initialization = self
                .initialization
                .as_mut()
                .ok_or(RuntimeError::InvalidState)?;
            let Some(record) = self.declarations.get(initialization.declaration) else {
                self.initialization = None;
                return Ok(());
            };
            let declaration = self
                .graph
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .declaration(&record.member)
                .ok_or(RuntimeError::InvalidState)?;
            let Some(attribute) = declaration.attributes.get(initialization.attribute) else {
                initialization.declaration += 1;
                initialization.attribute = 0;
                initialization.arguments.clear();
                initialization.decorator = None;
                continue;
            };
            let decorator = match &initialization.decorator {
                Some(decorator) => decorator.clone(),
                None => {
                    let decorator = self
                        .graph
                        .as_ref()
                        .ok_or(RuntimeError::InvalidState)?
                        .resolve_decorator(&record.member.module_url, &attribute.name)
                        .ok_or_else(|| {
                            RuntimeError::Decorator(format!(
                                "unknown decorator reference: {}",
                                attribute.name
                            ))
                        })?;
                    if record
                        .attributes
                        .borrow()
                        .iter()
                        .any(|previous| previous.decorator == decorator)
                    {
                        return Err(RuntimeError::Decorator(format!(
                            "decorator {} is applied more than once to {}",
                            attribute.name, declaration.name
                        )));
                    }
                    initialization.decorator = Some(decorator.clone());
                    decorator
                }
            };
            let environment = self
                .bindings
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .environment(&record.member.module_url)
                .ok_or(RuntimeError::InvalidState)?;
            let context = Gc::new(
                mc,
                Context {
                    module: record.member.module_url.clone(),
                    arguments: vec![],
                },
            );
            let (execution, completion) =
                if let Some(program) = attribute.args.get(initialization.arguments.len()) {
                    let mut base = PatternExecution::new(mc, Pattern::End, vec![], environment);
                    while !base.step(mc)? {}
                    (
                        ExpressionExecution::from_compiled_match(
                            mc,
                            &CompiledExpression::from_program(program.clone()),
                            base.result().ok_or(RuntimeError::InvalidState)?,
                        ),
                        Completion::AttributeArgument,
                    )
                } else {
                    (
                        ExpressionExecution::call_with_subject(
                            mc,
                            self.bindings
                                .as_ref()
                                .ok_or(RuntimeError::InvalidState)?
                                .callable(&decorator)
                                .ok_or(RuntimeError::InvalidState)?,
                            initialization.arguments.clone(),
                            environment,
                            crate::provenance::Origin { start: 0, end: 0 },
                            record.subject,
                        ),
                        Completion::Decorator,
                    )
                };
            self.frames.push(Frame {
                execution: Execution::Expression(execution),
                context,
                lexical_environment: environment,
                invocation: None,
                completion,
            });
            return Ok(());
        }
    }
    fn request_context(
        &self,
        mc: &Mutation<'gc>,
        request: &PatternRequest<'gc>,
    ) -> Result<Gc<'gc, Context>, RuntimeError> {
        if let Some(owner) = self
            .context_owners
            .owner(request.environment, request.program_identity())
        {
            return Ok(Gc::new(
                mc,
                Context {
                    module: self.declarations[owner].member.module_url.clone(),
                    arguments: vec![],
                },
            ));
        }
        let frame = self.frames.last().ok_or(RuntimeError::InvalidState)?;
        if request
            .environment
            .is_descendant_of(frame.lexical_environment)
        {
            return Ok(frame.context);
        }
        for module in self
            .graph
            .as_ref()
            .ok_or(RuntimeError::UnknownRule(
                request.name.clone().unwrap_or_else(|| "default".into()),
            ))?
            .graph
            .modules
            .keys()
        {
            if self
                .bindings
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .environment(module)
                .is_some_and(|env| request.environment.is_descendant_of(env))
            {
                return Ok(Gc::new(
                    mc,
                    Context {
                        module: module.clone(),
                        arguments: vec![],
                    },
                ));
            }
        }
        Err(RuntimeError::InvalidState)
    }

    fn named_target(
        &mut self,
        mc: &Mutation<'gc>,
        name: &str,
        context: Gc<'gc, Context>,
    ) -> Result<usize, RuntimeError> {
        if let Some((_, target)) = context.arguments.iter().find(|(key, _)| key == name) {
            return Ok(*target);
        }
        let member = self
            .graph
            .as_ref()
            .ok_or_else(|| RuntimeError::UnknownRule(name.into()))?
            .resolve(&context.module, name)
            .ok_or_else(|| RuntimeError::UnknownRule(name.into()))?;
        if member.kind != MemberKind::Rule {
            return Err(RuntimeError::NotRule(name.into()));
        }
        self.intern_declared_target(mc, member, vec![])
    }

    fn declared_target(
        &mut self,
        mc: &Mutation<'gc>,
        member: ModuleMember,
        arguments: Vec<usize>,
    ) -> Result<usize, RuntimeError> {
        let declaration = self
            .graph
            .as_ref()
            .ok_or(RuntimeError::InvalidState)?
            .declaration(&member)
            .ok_or(RuntimeError::InvalidState)?;
        if declaration.parameters.len() != arguments.len() {
            return Err(RuntimeError::InvalidArguments(format!(
                "invalid argument count for {}: expected {}, got {}",
                declaration.name,
                declaration.parameters.len(),
                arguments.len()
            )));
        }
        self.intern_declared_target(mc, member, arguments)
    }

    fn intern_declared_target(
        &mut self,
        mc: &Mutation<'gc>,
        member: ModuleMember,
        arguments: Vec<usize>,
    ) -> Result<usize, RuntimeError> {
        let declaration = self
            .graph
            .as_ref()
            .ok_or(RuntimeError::InvalidState)?
            .declaration(&member)
            .ok_or(RuntimeError::InvalidState)?;
        let key = TargetKey::Declared(member.clone(), arguments.clone());
        if let Some(target) = self.target_keys.get(&key) {
            return Ok(*target);
        }
        let context = Gc::new(
            mc,
            Context {
                module: member.module_url.clone(),
                arguments: declaration
                    .parameters
                    .iter()
                    .cloned()
                    .zip(arguments)
                    .collect(),
            },
        );
        let target = self.targets.len();
        self.targets.push(Target::Declared { member, context });
        self.target_keys.insert(key, target);
        Ok(target)
    }

    fn resolve_request(
        &mut self,
        mc: &Mutation<'gc>,
        request: &PatternRequest<'gc>,
        context: Gc<'gc, Context>,
    ) -> Result<usize, RuntimeError> {
        let member = match request.target_kind {
            ResolveTargetKind::Reference => {
                let name = request
                    .name
                    .as_deref()
                    .ok_or_else(|| RuntimeError::UnknownRule("missing name".into()))?;
                if let Some((_, target)) = context.arguments.iter().find(|(key, _)| key == name) {
                    match &self.targets[*target] {
                        Target::Declared { member, .. } => Some(member.clone()),
                        Target::Inline { .. } | Target::Special { .. } => {
                            if request.argument_count != 0 {
                                return Err(RuntimeError::InvalidArguments(format!(
                                    "bound argument {name} accepts no further arguments"
                                )));
                            }
                            return Ok(*target);
                        }
                    }
                } else {
                    self.graph
                        .as_ref()
                        .and_then(|graph| graph.resolve(&context.module, name))
                }
            }
            ResolveTargetKind::Run => self
                .graph
                .as_ref()
                .and_then(|graph| graph.export(&context.module, request.name.as_deref())),
            ResolveTargetKind::Special => return self.special_target(request, context),
        }
        .ok_or_else(|| {
            RuntimeError::UnknownRule(request.name.clone().unwrap_or_else(|| "default".into()))
        })?;
        if member.kind != MemberKind::Rule {
            return Err(RuntimeError::NotRule(
                request.name.clone().unwrap_or_else(|| "default".into()),
            ));
        }
        let declaration = self
            .graph
            .as_ref()
            .ok_or(RuntimeError::InvalidState)?
            .declaration(&member)
            .ok_or(RuntimeError::InvalidState)?;
        if declaration.parameters.len() != request.argument_count {
            return Err(RuntimeError::InvalidArguments(format!(
                "invalid argument count for {}: expected {}, got {}",
                declaration.name,
                declaration.parameters.len(),
                request.argument_count
            )));
        }
        let mut arguments = Vec::new();
        for index in 0..request.argument_count {
            let argument = request.argument_program(index)?;
            let target = if let Some(info) = argument.resolve_info()
                && info.target_kind == ResolveTargetKind::Reference
                && info.argument_count == 0
            {
                self.named_target(
                    mc,
                    info.name
                        .as_deref()
                        .ok_or_else(|| RuntimeError::UnknownRule("missing argument name".into()))?,
                    context,
                )?
            } else {
                let key = TargetKey::Inline(
                    argument.identity(),
                    request.environment.identity(),
                    Gc::as_ptr(context) as usize,
                );
                if let Some(target) = self.target_keys.get(&key) {
                    *target
                } else {
                    let target = self.targets.len();
                    self.targets.push(Target::Inline {
                        pattern: argument,
                        environment: request.environment,
                        context,
                    });
                    self.target_keys.insert(key, target);
                    target
                }
            };
            if let Target::Declared {
                member: argument_member,
                ..
            } = &self.targets[target]
                && argument_member == &member
            {
                return Err(RuntimeError::InvalidArguments(format!(
                    "invalid self reference: {}",
                    declaration.name
                )));
            }
            arguments.push(target);
        }
        self.declared_target(mc, member, arguments)
    }

    fn body(
        &self,
        mc: &Mutation<'gc>,
        request: &PatternRequest<'gc>,
        target: usize,
    ) -> Result<(PatternExecution<'gc>, Environment<'gc>), RuntimeError> {
        match &self.targets[target] {
            Target::Declared { member, .. } => {
                let declaration = self
                    .graph
                    .as_ref()
                    .ok_or(RuntimeError::InvalidState)?
                    .declaration(member)
                    .ok_or(RuntimeError::InvalidState)?;
                let environment = self
                    .bindings
                    .as_ref()
                    .ok_or(RuntimeError::InvalidState)?
                    .environment(&member.module_url)
                    .ok_or(RuntimeError::InvalidState)?;
                Ok((
                    request.rule_execution(mc, declaration.pattern.clone(), environment),
                    environment,
                ))
            }
            Target::Inline {
                pattern,
                environment,
                ..
            } => Ok((
                pattern.execution_on_input(mc, request.input(), *environment),
                *environment,
            )),
            Target::Special {
                pattern,
                environment,
                ..
            } => Ok((
                request.rule_execution(mc, pattern.clone(), *environment),
                *environment,
            )),
        }
    }

    fn special_target(
        &mut self,
        request: &PatternRequest<'gc>,
        context: Gc<'gc, Context>,
    ) -> Result<usize, RuntimeError> {
        let pattern = match request.special.as_ref().map(ResolveValue::special_body) {
            Some(SpecialBody::Program(pattern)) => pattern,
            Some(SpecialBody::MissingDefault) => {
                return Err(RuntimeError::InvalidArguments(
                    "Module does not have a default export, please specify which Rule you want to import"
                        .into(),
                ));
            }
            None => return Err(RuntimeError::Pattern(PatternError::NullValue)),
            Some(SpecialBody::Unrecognized) => {
                return Err(RuntimeError::InvalidArguments(
                    "special resolution requires a canonical module or rule value".into(),
                ));
            }
        };
        let environment = request.environment;
        let target = self.targets.len();
        self.targets.push(Target::Special {
            pattern,
            environment,
            context,
        });
        Ok(target)
    }

    fn observe(&mut self, dependency: Dependency) {
        for frame in &self.frames {
            if let Some(invocation) = &frame.invocation
                && let Some(inv_memo) = invocation.memo
                && inv_memo != dependency.memo
            {
                let dependencies = &mut self.memos[inv_memo].dependencies;
                if let Some(existing) = dependencies
                    .iter_mut()
                    .find(|existing| existing.memo == dependency.memo)
                {
                    *existing = dependency;
                } else {
                    dependencies.push(dependency);
                }
            }
        }
    }

    fn enter_active(&mut self, memo: Option<usize>, position: InputPosition) {
        let parent = self.active_marks.last().copied();
        let (domain, low) = if position.path.is_empty() {
            match parent {
                None => (Some(position.domain), Some(position.cursor)),
                Some(parent) if parent.domain == Some(position.domain) => (
                    parent.domain,
                    Some(
                        parent
                            .low
                            .map_or(position.cursor, |low| low.min(position.cursor)),
                    ),
                ),
                _ => (None, None),
            }
        } else {
            (None, None)
        };
        self.active_marks.push(ActiveMark { memo, domain, low });
    }

    fn leave_active(&mut self, memo: Option<usize>) -> Result<(), RuntimeError> {
        let active = self.active_marks.pop().ok_or(RuntimeError::InvalidState)?;
        if active.memo != memo {
            return Err(RuntimeError::InvalidState);
        }
        Ok(())
    }

    /// Declared, parameter-free rules proven never re-enterable at the same
    /// position skip packrat memo bookkeeping entirely.
    fn target_skips_memo(&self, target: usize) -> bool {
        match &self.targets[target] {
            Target::Declared { member, context } => {
                context.arguments.is_empty()
                    && self
                        .graph
                        .as_ref()
                        .is_some_and(|graph| graph.can_skip_memo(member))
            }
            Target::Inline { .. } | Target::Special { .. } => false,
        }
    }

    fn evict_memos(&mut self) {
        if self.active_marks.is_empty() {
            self.memos.clear();
            self.memo_keys.clear();
            return;
        }

        let mark = self
            .active_marks
            .last()
            .and_then(|active| Some((active.domain?, active.low?)));
        let Some((domain, low)) = mark else {
            return;
        };
        if low == 0 {
            return;
        }

        let mut keep = vec![true; self.memos.len()];
        for (index, memo) in self.memos.iter().enumerate() {
            let position = memo.input.position(memo.position);
            if position.domain == domain
                && position.path.is_empty()
                && position.cursor < low
                && !matches!(memo.state, MemoState::Pending | MemoState::Growing(_))
            {
                keep[index] = false;
            }
        }

        let mut protected = vec![false; self.memos.len()];
        let mut pending: Vec<usize> = self
            .active_marks
            .iter()
            .filter_map(|active| active.memo)
            .collect();
        while let Some(index) = pending.pop() {
            if index >= protected.len() || protected[index] {
                continue;
            }
            protected[index] = true;
            for dependency in self.memos[index]
                .dependencies
                .iter()
                .chain(&self.memos[index].seed_dependencies)
            {
                pending.push(dependency.memo);
            }
        }
        for (index, protected) in protected.into_iter().enumerate() {
            keep[index] |= protected;
        }

        if keep.iter().all(|keep| *keep) {
            return;
        }

        let mut remap = vec![None; self.memos.len()];
        let mut retained = Vec::with_capacity(keep.iter().filter(|keep| **keep).count());
        for (index, memo) in std::mem::take(&mut self.memos).into_iter().enumerate() {
            if keep[index] {
                remap[index] = Some(retained.len());
                retained.push(memo);
            }
        }
        for memo in &mut retained {
            memo.dependencies
                .retain_mut(|dependency| match remap[dependency.memo] {
                    Some(index) => {
                        dependency.memo = index;
                        true
                    }
                    None => false,
                });
            memo.seed_dependencies
                .retain_mut(|dependency| match remap[dependency.memo] {
                    Some(index) => {
                        dependency.memo = index;
                        true
                    }
                    None => false,
                });
        }
        for active in &mut self.active_marks {
            if let Some(memo) = active.memo {
                active.memo = Some(remap[memo].expect("active memo is retained"));
            }
        }
        for frame in &mut self.frames {
            if let Some(invocation) = &mut frame.invocation
                && let Some(memo) = invocation.memo
            {
                invocation.memo = Some(remap[memo].expect("active memo is retained"));
            }
        }
        self.memo_keys.retain(|_, index| {
            if let Some(mapped) = remap[*index] {
                *index = mapped;
                true
            } else {
                false
            }
        });
        self.memos = retained;
    }

    fn invoke(
        &mut self,
        mc: &Mutation<'gc>,
        request: PatternRequest<'gc>,
        target: usize,
    ) -> Result<(), RuntimeError> {
        if self.target_skips_memo(target) {
            let (body, environment) = self.body(mc, &request, target)?;
            self.enter_active(None, request.identity.position(request.position));
            self.frames.push(Frame {
                execution: Execution::Pattern(body),
                context: self.targets[target].context(),
                lexical_environment: environment,
                invocation: Some(Invocation {
                    request,
                    target,
                    memo: None,
                    pattern_match: None,
                    growing: false,
                }),
                completion: Completion::Rule,
            });
            self.body_attempts += 1;
            return Ok(());
        }
        let key = MemoKey {
            target,
            position: request.identity.position(request.position),
            recovery: request.recovery.is_enabled(),
        };
        let memo = if let Some(memo) = self.memo_keys.get(&key) {
            *memo
        } else {
            let memo = self.memos.len();
            self.memos.push(Memo {
                input: request.identity,
                stream: request.stream,
                position: request.position,
                state: MemoState::Vacant,
                version: 0,
                dependencies: vec![],
                seed_dependencies: vec![],
            });
            self.memo_keys.insert(key, memo);
            memo
        };
        let stale = self.memos[memo]
            .dependencies
            .iter()
            .any(|dependency| self.memos[dependency.memo].version != dependency.version);
        if stale && matches!(self.memos[memo].state, MemoState::Complete(_)) {
            self.memos[memo].state = MemoState::Vacant;
        }
        match &self.memos[memo].state {
            MemoState::Complete(outcome) | MemoState::Growing(outcome) => {
                let mut outcome = *outcome;
                let growing = matches!(self.memos[memo].state, MemoState::Growing(_));
                let dependency_count = if growing {
                    self.memos[memo].seed_dependencies.len()
                } else {
                    self.memos[memo].dependencies.len()
                };
                if !growing {
                    let seeded = (0..dependency_count).any(|index| {
                        let dependency = self.memos[memo].dependencies[index];
                        matches!(
                            self.memos[dependency.memo].state,
                            MemoState::Growing(seed) if seed.kind == MatchKind::Fail
                        )
                    });
                    if outcome.seeded != seeded {
                        outcome = PatternMatch::with_seeded(mc, outcome, seeded);
                    }
                }
                if growing {
                    self.observe(Dependency {
                        memo,
                        version: self.memos[memo].version,
                    });
                }
                for index in 0..dependency_count {
                    let dependency = if growing {
                        self.memos[memo].seed_dependencies[index]
                    } else {
                        self.memos[memo].dependencies[index]
                    };
                    self.observe(dependency);
                }
                self.memo_hits += 1;
                self.frames
                    .last_mut()
                    .ok_or(RuntimeError::InvalidState)?
                    .execution
                    .resume(
                        mc,
                        PatternMatch::boundary(
                            mc,
                            outcome.pattern_kind,
                            outcome,
                            request.environment,
                            outcome.value,
                        ),
                    )?;
                return Ok(());
            }
            MemoState::Pending => {
                // LR is a control signal, not a failed child. Unwind suspended
                // combinators to the cycle head before any can swallow it.
                let head = self
                    .frames
                    .iter()
                    .position(|frame| {
                        frame
                            .invocation
                            .as_ref()
                            .is_some_and(|invocation| invocation.memo == Some(memo))
                    })
                    .ok_or(RuntimeError::InvalidState)?;
                while self.frames.len() > head + 1 {
                    let discarded = self.frames.pop().ok_or(RuntimeError::InvalidState)?;
                    if let Some(invocation) = discarded.invocation {
                        if let Some(discarded_memo) = invocation.memo {
                            self.memos[discarded_memo].state = MemoState::Vacant;
                        }
                        self.leave_active(invocation.memo)?;
                    }
                }
                let head_request = self.frames[head]
                    .invocation
                    .as_ref()
                    .ok_or(RuntimeError::InvalidState)?
                    .request
                    .clone();
                let seed = PatternMatch::seed_failure(mc, &head_request);
                self.memos[memo].state = MemoState::Growing(seed);
                self.memos[memo].dependencies.clear();
                self.memos[memo].seed_dependencies.clear();
                let (body, environment) = self.body(mc, &head_request, target)?;
                self.frames[head].execution = Execution::Pattern(body);
                self.frames[head].lexical_environment = environment;
                let invocation = self.frames[head]
                    .invocation
                    .as_mut()
                    .ok_or(RuntimeError::InvalidState)?;
                invocation.growing = true;
                invocation.pattern_match = None;
                self.body_attempts += 1;
                return Ok(());
            }
            MemoState::Vacant => {}
        }
        self.memos[memo].state = MemoState::Pending;
        self.memos[memo].dependencies.clear();
        self.memos[memo].seed_dependencies.clear();
        let (body, environment) = self.body(mc, &request, target)?;
        self.enter_active(Some(memo), request.identity.position(request.position));
        self.frames.push(Frame {
            execution: Execution::Pattern(body),
            context: self.targets[target].context(),
            lexical_environment: environment,
            invocation: Some(Invocation {
                request,
                target,
                memo: Some(memo),
                pattern_match: None,
                growing: false,
            }),
            completion: Completion::Rule,
        });
        self.body_attempts += 1;
        Ok(())
    }

    fn finish_frame(&mut self, mc: &Mutation<'gc>) -> Result<(), RuntimeError> {
        let mut frame = self.frames.pop().ok_or(RuntimeError::InvalidState)?;
        if matches!(frame.execution, Execution::Metadata) {
            return Ok(());
        }
        if matches!(frame.completion, Completion::Serialization) {
            let Execution::Expression(execution) = frame.execution else {
                return Err(RuntimeError::InvalidState);
            };
            self.serialized = Some(execution.result().ok_or(RuntimeError::InvalidState)?);
            return Ok(());
        }
        if matches!(
            frame.completion,
            Completion::AttributeArgument | Completion::Decorator
        ) {
            let Execution::Expression(execution) = frame.execution else {
                return Err(RuntimeError::InvalidState);
            };
            let value = execution
                .result()
                .ok_or(RuntimeError::InvalidState)?
                .unwrap_deep(mc);
            let initialization = self
                .initialization
                .as_mut()
                .ok_or(RuntimeError::InvalidState)?;
            if matches!(frame.completion, Completion::AttributeArgument) {
                initialization.arguments.push(value);
            } else {
                let record = self.declarations[initialization.declaration];
                let declaration = self
                    .graph
                    .as_ref()
                    .ok_or(RuntimeError::InvalidState)?
                    .declaration(&record.member)
                    .ok_or(RuntimeError::InvalidState)?;
                let attribute = declaration
                    .attributes
                    .get(initialization.attribute)
                    .ok_or(RuntimeError::InvalidState)?;
                let Value::Object(metadata) = record.metadata else {
                    return Err(RuntimeError::InvalidState);
                };
                metadata
                    .borrow_mut(mc)
                    .set(attribute.name.clone().into(), value);
                record.attributes.borrow_mut(mc).push(ResolvedAttribute {
                    decorator: initialization
                        .decorator
                        .take()
                        .ok_or(RuntimeError::InvalidState)?,
                    arguments: std::mem::take(&mut initialization.arguments),
                });
                initialization.attribute += 1;
            }
            return Ok(());
        }
        let outcome = match &frame.execution {
            Execution::Pattern(execution) => {
                execution.result().ok_or(RuntimeError::InvalidState)?
            }
            Execution::Expression(execution) => {
                let value = execution.result().ok_or(RuntimeError::InvalidState)?;
                let invocation = frame
                    .invocation
                    .as_ref()
                    .ok_or(RuntimeError::InvalidState)?;
                let matched = PatternMatch::boundary(
                    mc,
                    invocation
                        .pattern_match
                        .ok_or(RuntimeError::InvalidState)?
                        .pattern_kind,
                    invocation.pattern_match.ok_or(RuntimeError::InvalidState)?,
                    invocation.request.environment,
                    value,
                );
                // A rule expression builds its own value, so a skipped body
                // becomes an ordinary success.
                if matched.kind == MatchKind::Skip {
                    PatternMatch::with_kind(mc, matched, MatchKind::Ok)
                } else {
                    matched
                }
            }
            Execution::Metadata => return Err(RuntimeError::InvalidState),
        };
        let Some(invocation) = frame.invocation.as_mut() else {
            if outcome.kind == MatchKind::Fail
                && !self.entry.recovery.is_enabled()
                && self.entry.recovery.was_reached()
            {
                self.entry.recovery = self.entry.recovery.enable();
                self.memos.clear();
                self.memo_keys.clear();
                self.targets.clear();
                self.target_keys.clear();
                let open = self.entry.open;
                self.frames.push(Frame {
                    execution: Execution::Pattern({
                        let mut restarted = match &self.entry.pattern {
                            Some(program) => PatternExecution::compiled_with_recovery(
                                mc,
                                program.clone(),
                                self.entry.input.clone(),
                                self.entry.environment,
                                0,
                                self.entry.recovery,
                            ),
                            None => PatternExecution::new_with_recovery(
                                mc,
                                Pattern::Resolve {
                                    target_kind: self.entry.target_kind,
                                    name: self.entry.export.clone(),
                                    args: vec![],
                                    value: None,
                                },
                                self.entry.input.clone(),
                                self.entry.environment,
                                self.entry.recovery,
                            ),
                        };
                        if open {
                            restarted.set_open();
                        }
                        restarted
                    }),
                    context: self.entry.context,
                    lexical_environment: self.entry.environment,
                    invocation: None,
                    completion: Completion::Root,
                });
                if let Some(source) = self.entry.source
                    && let Some(Frame {
                        execution: Execution::Pattern(pattern),
                        ..
                    }) = self.frames.last_mut()
                {
                    pattern.set_source(source);
                }
                return Ok(());
            }
            self.result = Some(outcome);
            self.evict_memos();
            return Ok(());
        };
        let progresses = if invocation.growing {
            let Some(memo) = invocation.memo else {
                return Err(RuntimeError::InvalidState);
            };
            match self.memos[memo].state {
                MemoState::Growing(seed) => {
                    outcome.end > seed.end && outcome.end > invocation.request.position
                }
                _ => return Err(RuntimeError::InvalidState),
            }
        } else {
            true
        };
        if matches!(frame.execution, Execution::Pattern(_))
            && outcome.kind != MatchKind::Fail
            && progresses
            && let Target::Declared { member, .. } = &self.targets[invocation.target]
            && let Some(program) = self
                .graph
                .as_ref()
                .ok_or(RuntimeError::InvalidState)?
                .declaration(member)
                .ok_or(RuntimeError::InvalidState)?
                .expression
                .clone()
        {
            let mut execution = ExpressionExecution::compiled(
                mc,
                program,
                outcome.environment,
                outcome.origin,
                outcome.value,
            );
            execution.set_match(outcome);
            execution.set_recovery(invocation.request.recovery);
            invocation.pattern_match = Some(outcome);
            frame.execution = Execution::Expression(execution);
            self.frames.push(frame);
            return Ok(());
        }
        let outcome = PatternMatch::boundary(
            mc,
            outcome.pattern_kind,
            outcome,
            invocation.request.environment,
            outcome.value,
        );
        let memo = invocation.memo;
        match memo {
            None => {
                // Skip-memo path: proven non-recursive, so growth is an invariant
                // violation (Deno surfaces MatchKind.LR the same way).
                if invocation.growing {
                    return Err(RuntimeError::InvalidState);
                }
                let outcome = self.mark_origin(mc, outcome, invocation.target);
                self.frames
                    .last_mut()
                    .ok_or(RuntimeError::InvalidState)?
                    .execution
                    .resume(mc, outcome)?;
            }
            Some(memo) if invocation.growing => {
                let seed = match self.memos[memo].state {
                    MemoState::Growing(seed) => seed,
                    _ => return Err(RuntimeError::InvalidState),
                };
                if outcome.kind != MatchKind::Fail
                    && (seed.kind == MatchKind::Fail || outcome.end > seed.end)
                    && outcome.end > invocation.request.position
                {
                    self.memos[memo].state = MemoState::Growing(outcome);
                    self.memos[memo].version += 1;
                    self.memos[memo].seed_dependencies = self.memos[memo].dependencies.clone();
                    self.memos[memo].dependencies.clear();
                    let (body, environment) =
                        self.body(mc, &invocation.request, invocation.target)?;
                    invocation.pattern_match = None;
                    frame.execution = Execution::Pattern(body);
                    frame.lexical_environment = environment;
                    self.frames.push(frame);
                    self.body_attempts += 1;
                    return Ok(());
                }
                let stabilized =
                    PatternMatch::growth_result(mc, seed, outcome, invocation.request.environment);
                let seed_dependencies = self.memos[memo].seed_dependencies.clone();
                for dependency in seed_dependencies {
                    if !self.memos[memo]
                        .dependencies
                        .iter()
                        .any(|existing| existing.memo == dependency.memo)
                    {
                        self.memos[memo].dependencies.push(dependency);
                    }
                }
                let stabilized = self.mark_origin(mc, stabilized, invocation.target);
                self.memos[memo].state = MemoState::Complete(stabilized);
                self.frames
                    .last_mut()
                    .ok_or(RuntimeError::InvalidState)?
                    .execution
                    .resume(mc, stabilized)?;
            }
            Some(memo) => {
                let outcome = self.mark_origin(mc, outcome, invocation.target);
                self.memos[memo].state = MemoState::Complete(outcome);
                self.frames
                    .last_mut()
                    .ok_or(RuntimeError::InvalidState)?
                    .execution
                    .resume(mc, outcome)?;
            }
        }
        self.leave_active(memo)?;
        self.evict_memos();
        Ok(())
    }

    fn mark_origin(
        &self,
        mc: &Mutation<'gc>,
        outcome: Gc<'gc, PatternMatch<'gc>>,
        target: usize,
    ) -> Gc<'gc, PatternMatch<'gc>> {
        if let Target::Declared { member, .. } = &self.targets[target]
            && let Some(index) = self
                .declarations
                .iter()
                .position(|declaration| &declaration.member == member)
        {
            let arguments = match &self.targets[target] {
                Target::Declared { context, .. } => context
                    .arguments
                    .iter()
                    .map(|(_, target)| *target)
                    .collect(),
                Target::Inline { .. } | Target::Special { .. } => unreachable!(),
            };
            PatternMatch::with_rule(mc, outcome, self.declarations[index], arguments)
        } else {
            outcome
        }
    }
}

fn diagnostic_chain<'gc>(
    matched: Gc<'gc, PatternMatch<'gc>>,
    parent: Option<Rc<DiagnosticChain<'gc>>>,
) -> Option<Rc<DiagnosticChain<'gc>>> {
    match matched.rule {
        Some(declaration) => Some(Rc::new(DiagnosticChain {
            parent,
            declaration,
            entered_at: matched.origin.start,
        })),
        None => parent,
    }
}

fn analyze_diagnostic<'gc>(
    root: Gc<'gc, PatternMatch<'gc>>,
    preceding: &[Gc<'gc, PatternMatch<'gc>>],
    inherited: Option<Rc<DiagnosticChain<'gc>>>,
    kind: DiagnosticKind,
    span: crate::provenance::Origin,
    explain: &impl Fn(&DeclarationMetadata<'gc>) -> Option<String>,
) -> Option<RuntimeDiagnostic> {
    let mut nodes: Vec<DiagnosticNode<'gc>> = Vec::new();
    let mut known = HashMap::<usize, usize>::new();
    let mut pending = vec![(root, 0, 0, inherited.clone(), None)];
    pending.extend(
        preceding
            .iter()
            .rev()
            .map(|matched| (*matched, 0, 0, inherited.clone(), None)),
    );
    while let Some((matched, absorbed, depth, parent, parent_index)) = pending.pop() {
        let address = Gc::as_ptr(matched) as usize;
        if let Some(index) = known.get(&address)
            && (nodes[*index].absorbed, nodes[*index].depth) <= (absorbed, depth)
        {
            continue;
        }
        let chain = diagnostic_chain(matched, parent);
        let node = DiagnosticNode {
            matched,
            absorbed,
            depth,
            chain: chain.clone(),
            parent: parent_index,
        };
        let index = if let Some(index) = known.get(&address) {
            nodes[*index] = node;
            *index
        } else {
            known.insert(address, nodes.len());
            nodes.push(node);
            nodes.len() - 1
        };
        let successes = absorbed + usize::from(matched.kind != MatchKind::Fail);
        match matched.pattern_kind {
            PatternKind::Not | PatternKind::Except => {}
            PatternKind::Lookahead | PatternKind::Pipeline if matched.kind != MatchKind::Fail => {}
            PatternKind::Pipeline => {
                if let Some(child) = matched.children.last() {
                    pending.push((*child, successes, depth + 1, chain, Some(index)));
                }
            }
            _ => pending.extend(
                matched
                    .children
                    .iter()
                    .rev()
                    .map(|child| (*child, successes, depth + 1, chain.clone(), Some(index))),
            ),
        }
    }
    let furthest = nodes
        .iter()
        .filter(|node| node.matched.kind == MatchKind::Fail && !node.matched.seeded)
        .map(|node| node.matched.origin.start)
        .max()?;
    let absorbed = nodes
        .iter()
        .filter(|node| {
            node.matched.kind == MatchKind::Fail
                && !node.matched.seeded
                && node.matched.origin.start == furthest
        })
        .map(|node| node.absorbed)
        .min()?;
    let tied: Vec<_> = nodes
        .iter()
        .filter(|node| {
            node.matched.kind == MatchKind::Fail
                && !node.matched.seeded
                && node.matched.origin.start == furthest
                && node.absorbed == absorbed
        })
        .collect();
    let focus = *tied.iter().min_by_key(|node| node.depth)?;
    let tied_addresses: std::collections::HashSet<_> = tied
        .iter()
        .map(|node| Gc::as_ptr(node.matched) as usize)
        .collect();
    let innermost: Vec<_> = tied
        .iter()
        .filter(|node| {
            !node
                .matched
                .children
                .iter()
                .any(|child| tied_addresses.contains(&(Gc::as_ptr(*child) as usize)))
        })
        .collect();
    let explaining: Vec<Vec<_>> = innermost
        .iter()
        .map(|node| {
            let failed_at = node
                .matched
                .current_origin()
                .map_or(node.matched.origin.start, |origin| origin.start);
            let mut chain = node.chain.clone();
            let mut candidates = Vec::new();
            while let Some(frame) = chain {
                if frame.entered_at == failed_at
                    && let Some(message) = explain(&frame.declaration)
                    && !message.is_empty()
                {
                    candidates.push((frame.declaration.member.clone(), message));
                }
                chain = frame.parent.clone();
            }
            candidates
        })
        .collect();
    let explanation = explaining.first().and_then(|first| {
        first
            .iter()
            .find(|(member, _)| {
                explaining
                    .iter()
                    .skip(1)
                    .all(|candidates| candidates.iter().any(|(other, _)| other == member))
            })
            .map(|(_, message)| message.clone())
    });
    let mut chain = focus.chain.clone();
    let mut rules = Vec::new();
    while let Some(frame) = chain {
        rules.push(DiagnosticRule {
            module_url: frame.declaration.member.module_url.to_string(),
            name: match frame.declaration.subject.raw() {
                Value::Declaration(declaration) => declaration.compiled.name.clone(),
                _ => frame.declaration.member.module_url.to_string(),
            },
            entered_at: frame.entered_at,
        });
        chain = frame.parent.clone();
    }
    rules.reverse();
    let mut expected = if let Some(terminal) = focus.matched.expectation() {
        vec![terminal]
    } else {
        nodes
            .iter()
            .filter(|node| {
                node.matched.kind == MatchKind::Fail
                    && !node.matched.seeded
                    && node.matched.origin.start == furthest
            })
            .filter_map(|node| node.matched.expectation())
            .collect()
    };
    expected.sort();
    expected.dedup();
    if expected.is_empty() {
        expected.push(focus.matched.descriptor());
    }
    let mut expected_values = Vec::new();
    if focus.matched.expectation().is_none() {
        let mut ancestor = focus.parent;
        while let Some(index) = ancestor {
            let node = &nodes[index];
            if node.matched.kind == MatchKind::Fail
                && node.matched.pattern_kind == PatternKind::Or
                && node.matched.origin.start == furthest
            {
                let alternatives: Vec<_> = node
                    .matched
                    .children
                    .iter()
                    .map(|child| {
                        let label = child.expectation().unwrap_or_else(|| child.descriptor());
                        label.strip_prefix("resolve ").unwrap_or(&label).to_owned()
                    })
                    .collect();
                if alternatives.len() > 1 {
                    expected_values = expected;
                    expected = alternatives;
                    expected.sort();
                    expected.dedup();
                }
                break;
            }
            ancestor = node.parent;
        }
    }
    for label in expected.iter_mut().chain(&mut expected_values) {
        if let Some(value) = label.strip_prefix("equal ") {
            *label = value.to_owned();
        }
    }
    let unexpected = focus.matched.current().map(|value| {
        crate::globals::json_text(value)
            .ok()
            .flatten()
            .unwrap_or_else(|| match value.raw() {
                Value::Undefined => "undefined".into(),
                _ => format!("{:?}", value.runtime_type()),
            })
    });
    let mut lines = vec![
        explanation
            .clone()
            .unwrap_or_else(|| format!("Expected {}", expected.join(", "))),
    ];
    if explanation.is_none() && !expected_values.is_empty() && expected_values != expected {
        lines.push(format!("e.g. {}", expected_values.join(", ")));
    }
    lines.push(format!(
        "Unexpected {}",
        unexpected.as_deref().unwrap_or("<end of input>")
    ));
    if let Some(rule) = rules.last() {
        lines.push(format!("In {}", rule.name));
    }
    let focus_span = focus.matched.origin;
    Some(RuntimeDiagnostic {
        kind,
        span: if kind == DiagnosticKind::Recovery {
            span
        } else {
            focus_span
        },
        focus_span,
        position: Some(focus.matched.identity.position(focus.matched.start)),
        unexpected,
        unexpected_span: focus.matched.current_origin(),
        expected,
        expected_values,
        rules,
        explanation,
        message: lines.join("\n"),
    })
}

pub struct Runtime {
    arena: Arena<Rootable![RuleExecution<'_>]>,
}

fn runtime_stale_request(error: &RuntimeError) -> bool {
    match error {
        RuntimeError::Expression(error) => is_stale_request(error),
        RuntimeError::Pattern(PatternError::Expression(error)) => is_stale_request(error),
        _ => false,
    }
}

impl HostExecution for Runtime {
    type Output = ();
    type Error = RuntimeError;
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
        self.run()
    }
    fn host_cancel(&mut self) {
        self.cancel();
    }
    fn host_invalid_state(&self) -> Self::Error {
        RuntimeError::InvalidState
    }
    fn host_unavailable(&self) -> Self::Error {
        EvaluationError::HostPending.into()
    }

    fn external_request(&mut self) -> Option<crate::evaluate::ExternalRequest> {
        self.take_input_request()
            .map(crate::evaluate::ExternalRequest::Input)
            .or_else(|| {
                self.take_host_request()
                    .map(crate::evaluate::ExternalRequest::Host)
            })
    }

    fn external_complete(
        &mut self,
        request: &crate::evaluate::ExternalRequest,
        completion: crate::evaluate::ExternalCompletion,
    ) -> Result<(), Self::Error> {
        match (request, completion) {
            (
                crate::evaluate::ExternalRequest::Host(request),
                crate::evaluate::ExternalCompletion::Host(completion),
            ) => self.complete_host(request, completion),
            (
                crate::evaluate::ExternalRequest::Input(request),
                crate::evaluate::ExternalCompletion::Input(completion),
            ) => self.complete_input(request, completion),
            _ => Err(RuntimeError::InvalidState),
        }
    }
}

impl Runtime {
    pub fn from_source(
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        source: input::Source,
        callables: Vec<HostCallable>,
    ) -> Result<Self, RuntimeError> {
        Ok(Self {
            arena: Arena::try_new(|mc| {
                let parent = Environment::new(
                    mc,
                    None,
                    callables
                        .into_iter()
                        .map(|callable| {
                            (
                                Rc::<str>::from(callable.name.clone()),
                                Value::host(mc, callable),
                            )
                        })
                        .collect(),
                );
                let source = input::InputSource::new(mc, source);
                let mut execution =
                    RuleExecution::with_environment(mc, graph, module, export, vec![], parent)?;
                execution.entry.source = Some(source);
                if let Execution::Pattern(pattern) = &mut execution.frames[0].execution {
                    pattern.set_source(source);
                }
                Ok::<_, RuntimeError>(execution)
            })?,
        })
    }

    pub fn pattern_from_source(pattern: Pattern, source: input::Source) -> Self {
        Self {
            arena: Arena::new(|mc| {
                let source = input::InputSource::new(mc, source);
                let mut execution = RuleExecution::for_pattern(mc, pattern, vec![]);
                execution.entry.source = Some(source);
                if let Execution::Pattern(pattern) = &mut execution.frames[0].execution {
                    pattern.set_source(source);
                }
                execution
            }),
        }
    }

    pub fn drive_external<H, F>(
        &mut self,
        host: H,
    ) -> crate::evaluate::ExternalDriver<'_, Self, H, F>
    where
        H: FnMut(&mut Self, crate::evaluate::ExternalRequest) -> F,
        F: Future<Output = crate::evaluate::ExternalCompletion>,
    {
        crate::evaluate::HostDriver::new(self, host)
    }

    pub fn take_input_request(&mut self) -> Option<input::InputRequest> {
        self.arena
            .mutate_root(|mc, execution| execution.take_input_request(mc))
    }

    pub fn complete_input(
        &mut self,
        request: &input::InputRequest,
        completion: Result<input::InputCompletion, String>,
    ) -> Result<(), RuntimeError> {
        let outcome = self
            .arena
            .mutate_root(|mc, execution| execution.complete_input(mc, request, completion));
        self.arena.collect_debt();
        outcome
    }

    pub fn with_hosts(
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: impl Into<crate::json::JsonValue>,
        mode: InputMode,
        callables: Vec<HostCallable>,
    ) -> Result<Self, RuntimeError> {
        Ok(Self {
            arena: Arena::try_new(|mc| {
                let parent = Environment::new(
                    mc,
                    None,
                    callables
                        .into_iter()
                        .map(|callable| {
                            (
                                Rc::<str>::from(callable.name.clone()),
                                Value::host(mc, callable),
                            )
                        })
                        .collect(),
                );
                let input = runtime_input(mc, input, mode)?;
                RuleExecution::with_environment(mc, graph, module, export, input, parent)
            })?,
        })
    }

    pub fn for_pattern_with_environment(
        pattern: Pattern,
        build: impl for<'gc> FnOnce(&Mutation<'gc>) -> (Vec<Value<'gc>>, Environment<'gc>),
    ) -> Self {
        Self {
            arena: Arena::new(|mc| {
                let (input, environment) = build(mc);
                let mut execution = RuleExecution::for_pattern(mc, Pattern::Ok, input.clone());
                execution.entry.environment = environment;
                let pattern = PatternProgram::compile(pattern);
                execution.entry.pattern = Some(pattern.clone());
                let root = &mut execution.frames[0];
                root.lexical_environment = environment;
                root.execution = Execution::Pattern(PatternExecution::compiled_with_recovery(
                    mc,
                    pattern,
                    input,
                    environment,
                    0,
                    execution.entry.recovery,
                ));
                execution
            }),
        }
    }

    pub fn drive<H, F>(&mut self, host: H) -> HostDriver<'_, Self, H, F>
    where
        H: FnMut(&mut Self, HostRequest) -> F,
        F: Future<Output = Result<HostCompletion, String>>,
    {
        HostDriver::new(self, host)
    }

    pub fn take_host_request(&mut self) -> Option<HostRequest> {
        self.arena
            .mutate_root(|mc, execution| execution.take_host_request(mc))
    }

    pub fn complete_host(
        &mut self,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), RuntimeError> {
        let outcome = self
            .arena
            .mutate_root(|mc, execution| execution.complete_host(mc, request, completion));
        self.arena.collect_debt();
        outcome
    }

    pub fn read_rooted<T>(
        &self,
        root: &RootedValue,
        read: impl for<'gc> FnOnce(Value<'gc>) -> T,
    ) -> Result<T, EvaluationError> {
        self.arena
            .mutate(|_, execution| execution.fetch_rooted(root).map(|value| read(value.raw())))
    }

    pub fn cancel(&mut self) {
        self.arena.mutate_root(|_, execution| execution.cancel());
        self.collect_all();
    }

    /// Re-evaluates a completed fixed-input parse after one flat-stream edit.
    /// Only rule matches whose observations are wholly before `at` are reused.
    /// Nested input under identical prefix items is eligible; recovery and
    /// unproven computed domains conservatively fall back to re-evaluation.
    pub fn reparse_edit(
        &mut self,
        post_edit: impl Into<crate::json::JsonValue>,
        mode: InputMode,
        at: usize,
        removed: usize,
        inserted: usize,
    ) -> Result<(), RuntimeError> {
        let result = self.arena.mutate_root(|mc, execution| {
            execution.reparse_edit(mc, post_edit, mode, at, removed, inserted)
        });
        self.arena.collect_debt();
        result
    }

    pub fn for_pattern(
        pattern: Pattern,
        input: impl Into<crate::json::JsonValue>,
        mode: InputMode,
    ) -> Result<Self, RuntimeError> {
        let arena = Arena::try_new(|mc| {
            let input = runtime_input(mc, input, mode)?;
            let mut execution = RuleExecution::for_pattern(mc, pattern, input);
            execution.entry.input_mode = Some(mode);
            Ok::<_, RuntimeError>(execution)
        })?;
        Ok(Self { arena })
    }

    pub fn for_pattern_data(pattern: Pattern, input: &crate::codec::data::DataDocument) -> Self {
        Self {
            arena: Arena::new(|mc| {
                RuleExecution::for_pattern(mc, pattern, vec![input.materialize(mc)])
            }),
        }
    }
    pub fn diagnostics(&self) -> Vec<RuntimeDiagnostic> {
        self.read(|execution| execution.diagnostics())
    }

    pub fn diagnostics_with(
        &self,
        explain: impl for<'gc> Fn(&DeclarationMetadata<'gc>) -> Option<String>,
    ) -> Vec<RuntimeDiagnostic> {
        self.read(|execution| execution.diagnostics_with(&explain))
    }
    pub fn metadata(graph: Rc<CompiledModuleGraph>) -> Result<Self, RuntimeError> {
        Ok(Self {
            arena: Arena::try_new(|mc| RuleExecution::metadata(mc, graph))?,
        })
    }
    pub fn new(
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: impl Into<crate::json::JsonValue>,
    ) -> Result<Self, RuntimeError> {
        Self::with_mode(graph, module, export, input, InputMode::Scalar)
    }

    pub fn with_mode(
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: impl Into<crate::json::JsonValue>,
        mode: InputMode,
    ) -> Result<Self, RuntimeError> {
        let arena = Arena::try_new(|mc| {
            let items = runtime_input(mc, input, mode)?;
            let mut execution = RuleExecution::new(mc, graph, module, export, items)?;
            execution.entry.input_mode = Some(mode);
            Ok::<_, RuntimeError>(execution)
        })?;
        Ok(Self { arena })
    }

    pub fn with_data(
        graph: Rc<CompiledModuleGraph>,
        module: &Url,
        export: Option<&str>,
        input: &crate::codec::data::DataDocument,
    ) -> Result<Self, RuntimeError> {
        Ok(Self {
            arena: Arena::try_new(|mc| {
                RuleExecution::new(mc, graph, module, export, vec![input.materialize(mc)])
            })?,
        })
    }

    pub fn for_member(
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: impl Into<crate::json::JsonValue>,
        mode: InputMode,
    ) -> Result<Self, RuntimeError> {
        let arena = Arena::try_new(|mc| {
            let items = runtime_input(mc, input, mode)?;
            RuleExecution::for_member(mc, graph, member, items)
        })?;
        Ok(Self { arena })
    }

    /// Like [`Runtime::for_member`], but the input is an open prefix (see
    /// [`RuleExecution::set_open_input`]).
    pub fn for_member_open(
        graph: Rc<CompiledModuleGraph>,
        member: &ModuleMember,
        input: impl Into<crate::json::JsonValue>,
        mode: InputMode,
    ) -> Result<Self, RuntimeError> {
        let arena = Arena::try_new(|mc| {
            let items = runtime_input(mc, input, mode)?;
            let mut execution = RuleExecution::for_member(mc, graph, member, items)?;
            execution.set_open_input();
            Ok::<_, RuntimeError>(execution)
        })?;
        Ok(Self { arena })
    }

    pub fn step(&mut self) -> Result<bool, RuntimeError> {
        match self.step_status()? {
            StepStatus::Complete => Ok(true),
            StepStatus::Yielded => Ok(false),
            StepStatus::Suspended => Err(EvaluationError::HostPending.into()),
        }
    }

    pub fn step_status(&mut self) -> Result<StepStatus, RuntimeError> {
        let result = self
            .arena
            .mutate_root(|mc, execution| execution.step_status(mc));
        self.arena.collect_debt();
        result
    }

    pub fn run(&mut self) -> Result<(), RuntimeError> {
        const STEPS_PER_MUTATION: usize = 512;
        loop {
            // Keep collector debt bounded without exposing every internal step.
            let (status, _) = self
                .arena
                .mutate_root(|mc, execution| execution.run_batch(mc, STEPS_PER_MUTATION))?;
            self.arena.collect_debt();
            match status {
                StepStatus::Complete => return Ok(()),
                StepStatus::Yielded => {}
                StepStatus::Suspended => return Err(EvaluationError::HostPending.into()),
            }
        }
    }

    pub fn collect_all(&mut self) {
        self.arena.finish_cycle();
    }

    pub fn serialize_result(&mut self) -> Result<Option<String>, RuntimeError> {
        self.arena
            .mutate_root(|mc, execution| execution.begin_serialize_result(mc))?;
        self.run()?;
        self.arena
            .mutate(|_, execution| execution.serialized_json())
    }

    pub fn serialize_metadata(
        &mut self,
        member: &ModuleMember,
    ) -> Result<Option<String>, RuntimeError> {
        self.arena
            .mutate_root(|mc, execution| execution.begin_serialize_metadata(mc, member))?;
        self.run()?;
        self.arena
            .mutate(|_, execution| execution.serialized_json())
    }

    pub fn read<R>(&self, f: impl for<'gc> FnOnce(&RuleExecution<'gc>) -> R) -> R {
        self.arena.mutate(|_, execution| f(execution))
    }
}

fn same_input_item<'gc>(left: Value<'gc>, right: Value<'gc>) -> bool {
    let mut pending = vec![(left, right)];
    while let Some((left, right)) = pending.pop() {
        match (left.raw(), right.raw()) {
            (Value::Number(left), Value::Number(right)) => {
                if left.to_bits() != right.to_bits() {
                    return false;
                }
            }
            (Value::Array(left), Value::Array(right)) => {
                let left = left.borrow();
                let right = right.borrow();
                if left.len() != right.len() {
                    return false;
                }
                pending.extend(left.iter().copied().zip(right.iter().copied()));
            }
            (Value::Object(left), Value::Object(right)) => {
                let left = left.borrow();
                let right = right.borrow();
                if left.entries().len() != right.entries().len() {
                    return false;
                }
                for ((left_key, left), (right_key, right)) in
                    left.entries().iter().zip(right.entries())
                {
                    if !left_key.same_value(right_key) {
                        return false;
                    }
                    pending.push((*left, *right));
                }
            }
            (left, right) if left.strict_eq(right) => {}
            _ => return false,
        }
    }
    true
}

pub(crate) fn runtime_input<'gc>(
    mc: &Mutation<'gc>,
    input: impl Into<crate::json::JsonValue>,
    mode: InputMode,
) -> Result<Vec<Value<'gc>>, RuntimeError> {
    let environment = Environment::new(mc, None, vec![]);
    let mut literal = ExpressionExecution::new(
        mc,
        Expression::Value {
            value: Some(
                crate::codec::data::DataDocument::from_json(input.into())
                    .expect("runtime input is a supported JSON value"),
            ),
        },
        environment,
        crate::provenance::Origin { start: 0, end: 0 },
        Value::Undefined,
    );
    while !literal.step(mc)? {}
    let value = literal
        .result()
        .ok_or(RuntimeError::InvalidState)?
        .raw()
        .wrap_root(mc);
    Ok(match mode {
        InputMode::Scalar => vec![value],
        InputMode::Empty => vec![],
        InputMode::Iterable => match value.raw() {
            Value::String(text) => text
                .code_points()
                .enumerate()
                .map(|(index, point)| {
                    value.carry_item(
                        mc,
                        Value::string(mc, crate::text::RuntimeString::from_utf16(point.to_vec())),
                        index,
                    )
                })
                .collect(),
            Value::Array(values) => values.borrow().clone(),
            _ => return Err(RuntimeError::Module("input is not iterable".into())),
        },
    })
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum InputMode {
    #[default]
    Scalar,
    Iterable,
    Empty,
}

#[cfg(test)]
mod engine_ports;
#[cfg(test)]
mod module_ports;
#[cfg(test)]
mod scope_ports;
#[cfg(test)]
mod selective_memo_ports;
#[cfg(test)]
mod tests;

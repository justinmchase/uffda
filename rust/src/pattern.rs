use crate::environment::Environment;
use crate::evaluate::{
    CompiledExpression, EvaluationError, ExpressionExecution, HostCompletion, HostRequest,
    RootedValue, StepStatus,
};
use crate::expression::Expression;
use crate::provenance::Origin;
use crate::runtime::input::{InputIdentity, InputPosition, PathSegment, RecoveryContext};
use crate::value::{RuntimeType, Value};
use crate::{json::JsonValue, text::RuntimeString};
use serde::Deserialize;
use std::collections::HashMap;
use std::ops::Deref;
use std::rc::Rc;
use std::sync::{Arc, Mutex, OnceLock};
use uffda_heap::{Collect, DynamicRootSet, Gc, Mutation, RefLock};

/// Child matches for a [`PatternMatch`].
///
/// Leaves and unary wrappers are the common case (0–1 children). Keeping those
/// inline avoids a heap allocation for the child list on every `set` / boundary
/// / unary resume. Sequences and choices spill to a `Vec`.
#[derive(Clone, Collect, Default)]
#[collect(no_drop)]
pub enum MatchChildren<'gc> {
    #[default]
    Empty,
    One(Gc<'gc, PatternMatch<'gc>>),
    Two([Gc<'gc, PatternMatch<'gc>>; 2]),
    Many(Vec<Gc<'gc, PatternMatch<'gc>>>),
}

impl<'gc> MatchChildren<'gc> {
    #[inline]
    pub const fn empty() -> Self {
        Self::Empty
    }

    #[inline]
    pub const fn one(child: Gc<'gc, PatternMatch<'gc>>) -> Self {
        Self::One(child)
    }

    #[inline]
    pub const fn two(
        first: Gc<'gc, PatternMatch<'gc>>,
        second: Gc<'gc, PatternMatch<'gc>>,
    ) -> Self {
        Self::Two([first, second])
    }

    #[inline]
    pub fn as_slice(&self) -> &[Gc<'gc, PatternMatch<'gc>>] {
        match self {
            Self::Empty => &[],
            Self::One(child) => std::slice::from_ref(child),
            Self::Two(children) => children,
            Self::Many(children) => children,
        }
    }
}

impl<'gc> Deref for MatchChildren<'gc> {
    type Target = [Gc<'gc, PatternMatch<'gc>>];

    #[inline]
    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

impl<'a, 'gc> IntoIterator for &'a MatchChildren<'gc> {
    type Item = &'a Gc<'gc, PatternMatch<'gc>>;
    type IntoIter = std::slice::Iter<'a, Gc<'gc, PatternMatch<'gc>>>;

    #[inline]
    fn into_iter(self) -> Self::IntoIter {
        self.as_slice().iter()
    }
}

impl<'gc> From<Vec<Gc<'gc, PatternMatch<'gc>>>> for MatchChildren<'gc> {
    fn from(mut children: Vec<Gc<'gc, PatternMatch<'gc>>>) -> Self {
        match children.len() {
            0 => Self::Empty,
            1 => Self::One(children.pop().expect("len checked")),
            2 => {
                let second = children.pop().expect("len checked");
                let first = children.pop().expect("len checked");
                Self::Two([first, second])
            }
            _ => Self::Many(children),
        }
    }
}

impl<'gc> FromIterator<Gc<'gc, PatternMatch<'gc>>> for MatchChildren<'gc> {
    fn from_iter<I: IntoIterator<Item = Gc<'gc, PatternMatch<'gc>>>>(iter: I) -> Self {
        Self::from(iter.into_iter().collect::<Vec<_>>())
    }
}

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
    And {
        patterns: Vec<Self>,
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
    Over {
        #[serde(default, deserialize_with = "deserialize_pattern_keys")]
        keys: Option<Vec<(RuntimeString, Self)>>,
        rest: Option<Vec<OverRestClause>>,
    },
    Switch {
        cases: Vec<SwitchCase>,
        default: Option<Box<Self>>,
    },
    Character {
        #[serde(rename = "characterClass")]
        character_class: String,
    },
    Regexp {
        pattern: RegExpSpec,
    },
    Resolve {
        #[serde(rename = "targetKind")]
        target_kind: ResolveTargetKind,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        args: Vec<Self>,
        #[serde(default, deserialize_with = "deserialize_resolve_value")]
        value: Option<ResolveValue>,
    },
    Projection {
        pattern: Box<Self>,
        expression: Box<Expression>,
    },
    Pipeline {
        steps: Vec<Self>,
    },
    Recover {
        pattern: Box<Self>,
        skip: Box<Self>,
    },
}

impl<'gc> PatternMatch<'gc> {
    pub fn boundary(
        mc: &Mutation<'gc>,
        pattern_kind: PatternKind,
        child: Gc<'gc, Self>,
        caller_environment: Environment<'gc>,
        value: Value<'gc>,
    ) -> Gc<'gc, Self> {
        Gc::new(
            mc,
            Self {
                kind: child.kind,
                value,
                start: child.start,
                end: child.end,
                environment: caller_environment,
                origin: child.origin,
                identity: child.identity,
                seeded: child.seeded,
                recovered: child.recovered,
                recovery: child.recovery,
                rule: None,
                children: MatchChildren::one(child),
                provenance: child.provenance.synthetic(),
                pattern_index: child.pattern_index,
                pattern_kind,
            },
        )
    }

    pub fn seed_failure(mc: &Mutation<'gc>, request: &PatternRequest<'gc>) -> Gc<'gc, Self> {
        let point = request
            .stream
            .get(request.position)
            .and_then(|value| value.origin())
            .map_or(request.base, |origin| origin.start);
        Gc::new(
            mc,
            Self {
                kind: MatchKind::Fail,
                value: Value::Undefined,
                start: request.position,
                end: request.position,
                environment: request.environment,
                origin: Origin {
                    start: point,
                    end: point,
                },
                identity: request.identity,
                seeded: true,
                recovered: false,
                recovery: request.recovery,
                rule: None,
                children: MatchChildren::empty(),
                provenance: PatternProvenance {
                    input: request.stream,
                    position: request.position,
                    base: request.base,
                    program: request.program.clone(),
                    index: request.pattern_index,
                    authored: false,
                    rule_arguments: None,
                },
                pattern_index: 0,
                pattern_kind: PatternKind::Fail,
            },
        )
    }

    pub fn growth_result(
        mc: &Mutation<'gc>,
        seed: Gc<'gc, Self>,
        rejected: Gc<'gc, Self>,
        caller_environment: Environment<'gc>,
    ) -> Gc<'gc, Self> {
        let seed_nonprogress = seed.kind != MatchKind::Fail && seed.end <= seed.start;
        let rejected = if rejected.kind != MatchKind::Fail {
            Gc::new(
                mc,
                Self {
                    kind: MatchKind::Fail,
                    value: Value::Undefined,
                    start: rejected.start,
                    end: rejected.start,
                    environment: rejected.environment,
                    origin: rejected.origin,
                    identity: rejected.identity,
                    seeded: false,
                    recovered: false,
                    recovery: rejected.recovery,
                    rule: None,
                    children: MatchChildren::one(rejected),
                    provenance: rejected.provenance.synthetic(),
                    pattern_index: rejected.pattern_index,
                    pattern_kind: rejected.pattern_kind,
                },
            )
        } else {
            rejected
        };
        let failed = seed.kind == MatchKind::Fail || seed_nonprogress;
        Gc::new(
            mc,
            Self {
                kind: if failed { MatchKind::Fail } else { seed.kind },
                value: if failed { Value::Undefined } else { seed.value },
                start: seed.start,
                end: if failed { seed.start } else { seed.end },
                environment: caller_environment,
                origin: seed.origin,
                identity: seed.identity,
                seeded: false,
                recovered: seed.recovered,
                recovery: seed.recovery,
                rule: None,
                children: if failed {
                    MatchChildren::one(rejected)
                } else {
                    MatchChildren::two(seed, rejected)
                },
                pattern_index: seed.pattern_index,
                provenance: seed.provenance.synthetic(),
                pattern_kind: seed.pattern_kind,
            },
        )
    }

    pub fn with_rule(
        mc: &Mutation<'gc>,
        child: Gc<'gc, Self>,
        rule: Gc<'gc, crate::runtime::DeclarationMetadata<'gc>>,
        arguments: Vec<usize>,
    ) -> Gc<'gc, Self> {
        let mut provenance = child.provenance.clone();
        provenance.rule_arguments = Some(Rc::from(arguments));
        Gc::new(
            mc,
            Self {
                kind: child.kind,
                value: child.value,
                start: child.start,
                end: child.end,
                environment: child.environment,
                origin: child.origin,
                identity: child.identity,
                seeded: child.seeded,
                recovered: child.recovered,
                recovery: child.recovery,
                rule: Some(rule),
                children: child.children.clone(),
                provenance,
                pattern_index: child.pattern_index,
                pattern_kind: child.pattern_kind,
            },
        )
    }

    pub fn rule_arguments(&self) -> Option<&[usize]> {
        self.provenance.rule_arguments.as_deref()
    }

    pub fn with_rebased_input(
        mc: &Mutation<'gc>,
        child: Gc<'gc, Self>,
        identity: InputIdentity<'gc>,
        input: crate::runtime::input::InputBuffer<'gc>,
        recovery: RecoveryContext<'gc>,
    ) -> Gc<'gc, Self> {
        let old_domain = child.identity.position(0).domain;
        let mut rebased = std::collections::HashMap::new();
        let mut pending = vec![(child, false)];
        while let Some((node, visited)) = pending.pop() {
            let address = Gc::as_ptr(node) as usize;
            if rebased.contains_key(&address) {
                continue;
            }
            if !visited {
                pending.push((node, true));
                pending.extend(node.children.iter().rev().map(|child| (*child, false)));
                continue;
            }
            let position = node.identity.position(0);
            let mut provenance = node.provenance.clone();
            let same_domain = position.domain == old_domain;
            if same_domain && position.path.is_empty() {
                provenance.input = input;
            }
            rebased.insert(
                address,
                Gc::new(
                    mc,
                    Self {
                        kind: node.kind,
                        value: node.value,
                        start: node.start,
                        end: node.end,
                        environment: node.environment,
                        origin: node.origin,
                        identity: if same_domain {
                            node.identity.rebased(identity)
                        } else {
                            node.identity
                        },
                        seeded: node.seeded,
                        recovered: node.recovered,
                        recovery: if node.recovery.is_enabled() {
                            recovery.enable()
                        } else {
                            recovery.disable()
                        },
                        rule: node.rule,
                        children: node
                            .children
                            .iter()
                            .map(|child| rebased[&(Gc::as_ptr(*child) as usize)])
                            .collect(),
                        provenance,
                        pattern_index: node.pattern_index,
                        pattern_kind: node.pattern_kind,
                    },
                ),
            );
        }
        rebased[&(Gc::as_ptr(child) as usize)]
    }

    pub fn with_kind(mc: &Mutation<'gc>, matched: Gc<'gc, Self>, kind: MatchKind) -> Gc<'gc, Self> {
        Gc::new(
            mc,
            Self {
                kind,
                value: matched.value,
                start: matched.start,
                end: matched.end,
                environment: matched.environment,
                origin: matched.origin,
                identity: matched.identity,
                seeded: matched.seeded,
                recovered: matched.recovered,
                recovery: matched.recovery,
                rule: matched.rule,
                children: matched.children.clone(),
                provenance: matched.provenance.clone(),
                pattern_index: matched.pattern_index,
                pattern_kind: matched.pattern_kind,
            },
        )
    }

    pub fn with_seeded(mc: &Mutation<'gc>, child: Gc<'gc, Self>, seeded: bool) -> Gc<'gc, Self> {
        Gc::new(
            mc,
            Self {
                kind: child.kind,
                value: child.value,
                start: child.start,
                end: child.end,
                environment: child.environment,
                origin: child.origin,
                identity: child.identity,
                seeded,
                recovered: child.recovered,
                recovery: child.recovery,
                rule: child.rule,
                children: child.children.clone(),
                provenance: child.provenance.clone(),
                pattern_index: child.pattern_index,
                pattern_kind: child.pattern_kind,
            },
        )
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Collect, PartialEq, Eq)]
#[collect(require_static)]
#[serde(rename_all = "lowercase")]
pub enum ResolveTargetKind {
    Reference,
    Run,
    Special,
}

/// A resolve special is a module default or a rule, carried as a compiled
/// pattern. JSON that is not one of those stays opaque.
#[derive(Clone)]
pub struct ResolveValue {
    kind: ResolveKind,
}

#[derive(Clone)]
enum ResolveKind {
    Json(JsonValue),
    Module { default: Option<Rc<PatternProgram>> },
    Rule { pattern: Rc<PatternProgram> },
}

pub(crate) enum SpecialBody {
    Program(Rc<PatternProgram>),
    MissingDefault,
    Unrecognized,
}

impl ResolveValue {
    fn json(value: JsonValue) -> Self {
        Self {
            kind: ResolveKind::Json(value),
        }
    }

    pub(crate) fn rule(pattern: Pattern) -> Self {
        Self {
            kind: ResolveKind::Rule {
                pattern: PatternProgram::compile(pattern),
            },
        }
    }

    pub(crate) fn module(default: Option<Pattern>) -> Self {
        Self {
            kind: ResolveKind::Module {
                default: default.map(PatternProgram::compile),
            },
        }
    }

    /// True when this special is a concrete embedded rule pattern (not a module
    /// default or opaque JSON value).
    pub(crate) fn is_rule(&self) -> bool {
        matches!(self.kind, ResolveKind::Rule { .. })
    }

    pub(crate) fn special_body(&self) -> SpecialBody {
        match &self.kind {
            ResolveKind::Module {
                default: Some(pattern),
            }
            | ResolveKind::Rule { pattern } => SpecialBody::Program(Rc::clone(pattern)),
            ResolveKind::Module { default: None } => SpecialBody::MissingDefault,
            ResolveKind::Json(_) => SpecialBody::Unrecognized,
        }
    }

    fn json_text(&self) -> Option<String> {
        match &self.kind {
            ResolveKind::Json(value) => Some(value.to_string()),
            _ => None,
        }
    }

    fn take_json(&mut self) -> Option<JsonValue> {
        match &mut self.kind {
            ResolveKind::Json(value) => Some(std::mem::replace(value, JsonValue::Null)),
            _ => None,
        }
    }
}

impl std::fmt::Debug for ResolveValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.kind {
            ResolveKind::Json(value) => f.debug_tuple("Json").field(value).finish(),
            ResolveKind::Module { default } => f
                .debug_struct("Module")
                .field("default", &default.is_some())
                .finish(),
            ResolveKind::Rule { .. } => f.debug_struct("Rule").finish(),
        }
    }
}

fn special_from_json(value: &JsonValue) -> Option<Result<ResolveValue, String>> {
    let JsonValue::Object(object) = value else {
        return None;
    };
    let JsonValue::String(kind) = object.get("kind")? else {
        return None;
    };
    let pattern_of = |value: &JsonValue| {
        crate::json::from_value(value.clone()).map_err(|error| error.to_string())
    };
    if kind == "rule" {
        let Some(pattern) = object.get("pattern") else {
            return Some(Err("rule special requires a pattern".into()));
        };
        return Some(pattern_of(pattern).map(ResolveValue::rule));
    }
    if kind == "module" {
        let default = match object.get("default") {
            None | Some(JsonValue::Null) => None,
            Some(pattern) => match pattern_of(pattern) {
                Ok(pattern) => Some(pattern),
                Err(error) => return Some(Err(error)),
            },
        };
        return Some(Ok(ResolveValue::module(default)));
    }
    None
}

fn deserialize_resolve_value<'de, D>(deserializer: D) -> Result<Option<ResolveValue>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let Some(value) = Option::<JsonValue>::deserialize(deserializer)? else {
        return Ok(None);
    };
    if matches!(value, JsonValue::Null) {
        return Ok(None);
    }
    if let Some(special) = special_from_json(&value) {
        return special.map(Some).map_err(serde::de::Error::custom);
    }
    Ok(Some(ResolveValue::json(value)))
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum RegExpSpec {
    Source(RuntimeString),
    Detailed {
        source: RuntimeString,
        #[serde(default)]
        flags: String,
    },
}

fn deserialize_pattern_keys<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<(RuntimeString, Pattern)>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<JsonValue>::deserialize(deserializer)?;
    match value {
        None => Ok(None),
        Some(JsonValue::Object(values)) => values
            .into_iter()
            .map(|(key, value)| {
                crate::json::from_value(value)
                    .map(|pattern| (key, pattern))
                    .map_err(serde::de::Error::custom)
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Some),
        Some(_) => Err(serde::de::Error::custom(
            "over keys must be an object of patterns",
        )),
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OverRestClause {
    Pattern {
        entry: Option<String>,
        key: Box<Pattern>,
        value: Box<Pattern>,
    },
    Any,
}

#[derive(Debug, Deserialize)]
pub struct SwitchCase {
    key: SwitchKey,
    pattern: Box<Pattern>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum SwitchKey {
    Values {
        values: Vec<ValueSource>,
    },
    CharacterClass {
        #[serde(rename = "characterClass")]
        character_class: String,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub enum PatternKind {
    Any,
    Ok,
    Fail,
    End,
    Equal,
    Includes,
    Between,
    And,
    Then,
    Or,
    Variable,
    Maybe,
    Not,
    Lookahead,
    Skip,
    Into,
    Except,
    Type,
    Quantifier,
    Over,
    Switch,
    Character,
    Regexp,
    Resolve,
    Projection,
    Pipeline,
    Recover,
}

impl PatternKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Any => "any",
            Self::Ok => "ok",
            Self::Fail => "fail",
            Self::End => "end",
            Self::Equal => "equal",
            Self::Includes => "includes",
            Self::Between => "between",
            Self::And => "and",
            Self::Then => "then",
            Self::Or => "or",
            Self::Variable => "variable",
            Self::Maybe => "maybe",
            Self::Not => "not",
            Self::Lookahead => "lookahead",
            Self::Skip => "skip",
            Self::Into => "into",
            Self::Except => "except",
            Self::Type => "type",
            Self::Quantifier => "quantifier",
            Self::Over => "over",
            Self::Switch => "switch",
            Self::Character => "character",
            Self::Regexp => "regexp",
            Self::Resolve => "resolve",
            Self::Projection => "projection",
            Self::Pipeline => "pipeline",
            Self::Recover => "recover",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind")]
pub enum ValueSource {
    #[serde(rename = "value.literal")]
    Literal {
        #[serde(default, deserialize_with = "deserialize_literal_value")]
        value: LiteralValue,
    },
    #[serde(rename = "value.variable")]
    Variable { name: String },
}

#[derive(Clone, Debug, Default)]
pub enum LiteralValue {
    #[default]
    Missing,
    Present(JsonValue),
}

impl ValueSource {
    fn descriptor(&self) -> String {
        match self {
            Self::Variable { name } => format!("variable {name}"),
            Self::Literal {
                value: LiteralValue::Missing,
            } => "undefined".into(),
            Self::Literal {
                value: LiteralValue::Present(value),
            } => match value {
                JsonValue::Array(_) => "array literal".into(),
                JsonValue::Object(_) => "object literal".into(),
                _ => value.to_string(),
            },
        }
    }
}

fn deserialize_literal_value<'de, D>(deserializer: D) -> Result<LiteralValue, D::Error>
where
    D: serde::Deserializer<'de>,
{
    JsonValue::deserialize(deserializer).map(LiteralValue::Present)
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
    And(Rc<[usize]>),
    Then(Rc<[usize]>),
    Or(Rc<[usize]>),
    Variable(Rc<str>, usize),
    Unary(Unary, usize),
    Type(RuntimeType),
    Quantifier(usize, Option<ValueSource>, Option<ValueSource>),
    Over(Vec<(RuntimeString, usize)>, Vec<OverRestNode>),
    Switch(Vec<(SwitchKey, usize)>, Option<usize>),
    /// Precompiled character-class matcher. `regex` is `None` for unknown
    /// class names; matching then reports the same invalid-argument error as
    /// before.
    Character(String, Option<Arc<regress::Regex>>),
    Regexp(RegExpSpec, Option<Arc<regress::Regex>>),
    Resolve {
        target_kind: ResolveTargetKind,
        name: Option<Rc<str>>,
        args: Rc<[usize]>,
        value: Option<ResolveValue>,
    },
    Projection(usize, CompiledExpression),
    Pipeline(Rc<[usize]>),
    Recover(usize, usize),
}

#[derive(Clone, Collect)]
#[collect(require_static)]
enum OverRestNode {
    Pattern {
        entry: Option<String>,
        key: usize,
        value: usize,
    },
    Any,
}

#[derive(Collect)]
#[collect(no_drop)]
struct OverState<'gc> {
    start: Scope<'gc>,
    source: Value<'gc>,
    fields: Vec<(Value<'gc>, Value<'gc>)>,
    declared: Vec<(RuntimeString, usize)>,
    rest: Vec<OverRestNode>,
    fixed_index: usize,
    entry_index: usize,
    clause_index: usize,
    stage: OverStage,
    environment: Environment<'gc>,
    children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    captures: Vec<(String, Vec<Value<'gc>>)>,
}

#[derive(Clone, Copy, Collect)]
#[collect(require_static)]
enum OverStage {
    Fixed,
    RestKey,
    RestValue,
}

impl PatternNode {
    fn kind(&self) -> PatternKind {
        match self {
            Self::Any => PatternKind::Any,
            Self::Ok => PatternKind::Ok,
            Self::Fail => PatternKind::Fail,
            Self::End => PatternKind::End,
            Self::Equal(_) => PatternKind::Equal,
            Self::Includes(_) => PatternKind::Includes,
            Self::Between(_, _) => PatternKind::Between,
            Self::And(_) => PatternKind::And,
            Self::Then(_) => PatternKind::Then,
            Self::Or(_) => PatternKind::Or,
            Self::Variable(_, _) => PatternKind::Variable,
            Self::Unary(unary, _) => match unary {
                Unary::Maybe => PatternKind::Maybe,
                Unary::Not => PatternKind::Not,
                Unary::Lookahead => PatternKind::Lookahead,
                Unary::Skip => PatternKind::Skip,
                Unary::Into => PatternKind::Into,
                Unary::Except => PatternKind::Except,
            },
            Self::Type(_) => PatternKind::Type,
            Self::Quantifier(_, _, _) => PatternKind::Quantifier,
            Self::Over(_, _) => PatternKind::Over,
            Self::Switch(_, _) => PatternKind::Switch,
            Self::Character(_, _) => PatternKind::Character,
            Self::Regexp(_, _) => PatternKind::Regexp,
            Self::Resolve { .. } => PatternKind::Resolve,
            Self::Projection(_, _) => PatternKind::Projection,
            Self::Pipeline(_) => PatternKind::Pipeline,
            Self::Recover(_, _) => PatternKind::Recover,
        }
    }
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

/// One statically visible resolve site inside a compiled pattern, used by
/// selective-memoization call-graph analysis.
pub(crate) struct ResolveSite<'a> {
    pub target_kind: ResolveTargetKind,
    pub name: Option<&'a str>,
    pub argument_count: usize,
    pub value: Option<&'a ResolveValue>,
}

impl PatternProgram {
    /// Walk every resolve node in this program (structural children only; special
    /// rule bodies are not inlined — they are call edges to a concrete rule).
    pub(crate) fn resolve_sites(&self) -> Vec<ResolveSite<'_>> {
        let mut sites = Vec::new();
        let mut pending = vec![0usize];
        let mut seen = vec![false; self.nodes.len()];
        while let Some(index) = pending.pop() {
            if index >= self.nodes.len() || seen[index] {
                continue;
            }
            seen[index] = true;
            match &self.nodes[index] {
                PatternNode::And(children)
                | PatternNode::Then(children)
                | PatternNode::Or(children)
                | PatternNode::Pipeline(children) => {
                    pending.extend(children.iter().copied());
                }
                PatternNode::Variable(_, child)
                | PatternNode::Unary(_, child)
                | PatternNode::Quantifier(child, _, _)
                | PatternNode::Projection(child, _) => pending.push(*child),
                PatternNode::Recover(pattern, skip) => {
                    pending.push(*pattern);
                    pending.push(*skip);
                }
                PatternNode::Over(keys, rest) => {
                    pending.extend(keys.iter().map(|(_, child)| *child));
                    for clause in rest {
                        if let OverRestNode::Pattern { key, value, .. } = clause {
                            pending.push(*key);
                            pending.push(*value);
                        }
                    }
                }
                PatternNode::Switch(cases, default) => {
                    pending.extend(cases.iter().map(|(_, child)| *child));
                    if let Some(default) = default {
                        pending.push(*default);
                    }
                }
                PatternNode::Resolve {
                    target_kind,
                    name,
                    args,
                    value,
                } => {
                    sites.push(ResolveSite {
                        target_kind: *target_kind,
                        name: name.as_deref(),
                        argument_count: args.len(),
                        value: value.as_ref(),
                    });
                    // Mirror Deno `childPatterns`: only reference resolves expose
                    // args as structural children (and only when empty — a
                    // non-empty arg list is treated as dynamic by the analysis
                    // before those children would be visited).
                    if *target_kind == ResolveTargetKind::Reference && args.is_empty() {
                        pending.extend(args.iter().copied());
                    }
                }
                PatternNode::Any
                | PatternNode::Ok
                | PatternNode::Fail
                | PatternNode::End
                | PatternNode::Equal(_)
                | PatternNode::Includes(_)
                | PatternNode::Between(_, _)
                | PatternNode::Type(_)
                | PatternNode::Character(_, _)
                | PatternNode::Regexp(_, _) => {}
            }
        }
        sites
    }

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
                Pattern::And { patterns } => PatternNode::And(
                    patterns
                        .into_iter()
                        .map(&mut child)
                        .collect::<Vec<_>>()
                        .into(),
                ),
                Pattern::Then { patterns } => PatternNode::Then(
                    patterns
                        .into_iter()
                        .map(&mut child)
                        .collect::<Vec<_>>()
                        .into(),
                ),
                Pattern::Or { patterns } => PatternNode::Or(
                    patterns
                        .into_iter()
                        .map(&mut child)
                        .collect::<Vec<_>>()
                        .into(),
                ),
                Pattern::Variable { name, pattern } => {
                    PatternNode::Variable(Rc::from(name), child(*pattern))
                }
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
                Pattern::Over { keys, rest } => PatternNode::Over(
                    keys.unwrap_or_default()
                        .into_iter()
                        .map(|(key, pattern)| (key, child(pattern)))
                        .collect(),
                    rest.unwrap_or_default()
                        .into_iter()
                        .map(|clause| match clause {
                            OverRestClause::Pattern { entry, key, value } => {
                                OverRestNode::Pattern {
                                    entry,
                                    key: child(*key),
                                    value: child(*value),
                                }
                            }
                            OverRestClause::Any => OverRestNode::Any,
                        })
                        .collect(),
                ),
                Pattern::Switch { cases, default } => PatternNode::Switch(
                    cases
                        .into_iter()
                        .map(|case| (case.key, child(*case.pattern)))
                        .collect(),
                    default.map(|pattern| child(*pattern)),
                ),
                Pattern::Character { character_class } => {
                    let regex = character_class_regex(&character_class).ok();
                    PatternNode::Character(character_class, regex)
                }
                Pattern::Regexp { pattern } => {
                    let regex = compile_regexp_spec(&pattern).ok();
                    PatternNode::Regexp(pattern, regex)
                }
                Pattern::Resolve {
                    target_kind,
                    name,
                    args,
                    value,
                } => PatternNode::Resolve {
                    target_kind,
                    name: name.map(Rc::from),
                    args: args.into_iter().map(&mut child).collect::<Vec<_>>().into(),
                    value,
                },
                Pattern::Projection {
                    pattern,
                    expression,
                } => PatternNode::Projection(child(*pattern), CompiledExpression::new(*expression)),
                Pattern::Pipeline { steps } => PatternNode::Pipeline(
                    steps.into_iter().map(&mut child).collect::<Vec<_>>().into(),
                ),
                Pattern::Recover { pattern, skip } => {
                    PatternNode::Recover(child(*pattern), child(*skip))
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
            if let ValueSource::Literal {
                value: LiteralValue::Present(value),
            } = source
            {
                pending.push(std::mem::replace(value, JsonValue::Null));
            }
        };
        let mut resolve_json = Vec::new();
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
                PatternNode::Switch(cases, _) => {
                    for (key, _) in cases {
                        if let SwitchKey::Values { values } = key {
                            values.iter_mut().for_each(&mut take);
                        }
                    }
                }
                PatternNode::Resolve { value, .. } => {
                    if let Some(value) = value.as_mut().and_then(ResolveValue::take_json) {
                        resolve_json.push(value);
                    }
                }
                _ => {}
            }
        }
        pending.extend(resolve_json);
        while let Some(value) = pending.pop() {
            match value {
                JsonValue::Array(values) => pending.extend(values),
                JsonValue::Object(values) => pending.extend(values.into_iter().map(|(_, v)| v)),
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
    InvalidArgument(String),
    TypeError(String),
    NullValue,
    Expression(Box<EvaluationError>),
}

impl std::fmt::Display for PatternError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownValueReference(name) => write!(f, "Unknown value reference ${name}"),
            Self::DuplicateVariable(name) => write!(f, "Variable {name} already exists in scope"),
            Self::IterableExpected => write!(f, "expected value to be iterable"),
            Self::InvalidState => write!(f, "invalid pattern execution state"),
            Self::InvalidBound(message) => message.fmt(f),
            Self::InvalidArgument(message) | Self::TypeError(message) => message.fmt(f),
            Self::NullValue => write!(f, "expected value to be non-null"),
            Self::Expression(error) => error.fmt(f),
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
    input: crate::runtime::input::InputBuffer<'gc>,
    source: Option<crate::runtime::input::InputSource<'gc>>,
    identity: InputIdentity<'gc>,
    recovery: RecoveryContext<'gc>,
    position: usize,
    environment: Environment<'gc>,
    base: usize,
    open: bool,
    pub(crate) pattern_index: usize,
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
    pub identity: InputIdentity<'gc>,
    pub seeded: bool,
    pub recovered: bool,
    pub recovery: RecoveryContext<'gc>,
    pub rule: Option<Gc<'gc, crate::runtime::DeclarationMetadata<'gc>>>,
    pub children: MatchChildren<'gc>,
    provenance: PatternProvenance<'gc>,
    pattern_index: usize,
    pub pattern_kind: PatternKind,
}

#[derive(Clone, Collect)]
#[collect(no_drop)]
struct PatternProvenance<'gc> {
    input: crate::runtime::input::InputBuffer<'gc>,
    position: usize,
    base: usize,
    #[collect(require_static)]
    program: Rc<PatternProgram>,
    index: usize,
    authored: bool,
    #[collect(require_static)]
    rule_arguments: Option<Rc<[usize]>>,
}

impl<'gc> PatternProvenance<'gc> {
    fn synthetic(&self) -> Self {
        Self {
            authored: false,
            ..self.clone()
        }
    }
}

impl<'gc> PatternMatch<'gc> {
    pub fn current(&self) -> Option<Value<'gc>> {
        self.provenance.input.get(self.provenance.position).copied()
    }

    pub fn current_origin(&self) -> Option<Origin> {
        if let Some(value) = self.current() {
            return Some(value.origin().unwrap_or(Origin {
                start: self.provenance.base + self.provenance.position,
                end: self.provenance.base + self.provenance.position + 1,
            }));
        }
        let point = self
            .provenance
            .input
            .last()
            .and_then(|value| value.origin())
            .map_or(self.provenance.base + self.provenance.position, |origin| {
                origin.end
            });
        Some(Origin {
            start: point,
            end: point,
        })
    }

    pub fn descriptor(&self) -> String {
        let node = &self.provenance.program.nodes[self.provenance.index];
        match node {
            PatternNode::Equal(source) => format!("equal {}", source.descriptor()),
            PatternNode::Includes(sources) => format!(
                "includes {}",
                sources
                    .iter()
                    .map(ValueSource::descriptor)
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            PatternNode::Between(left, right) => format!(
                "between {} and {}",
                left.as_ref()
                    .map_or_else(|| "unbounded".into(), ValueSource::descriptor),
                right
                    .as_ref()
                    .map_or_else(|| "unbounded".into(), ValueSource::descriptor)
            ),
            PatternNode::Type(expected) => format!("type {expected}"),
            PatternNode::Character(class, _) => format!("character {class}"),
            PatternNode::Regexp(spec, _) => format!("regexp {spec:?}"),
            PatternNode::Resolve {
                name: Some(name), ..
            } => format!("resolve {name}"),
            _ => format!("{:?}", node.kind()).to_lowercase(),
        }
    }

    pub fn expectation(&self) -> Option<String> {
        match &self.provenance.program.nodes[self.provenance.index] {
            PatternNode::Any
            | PatternNode::End
            | PatternNode::Equal(_)
            | PatternNode::Includes(_)
            | PatternNode::Between(..)
            | PatternNode::Type(_)
            | PatternNode::Character(_, _)
            | PatternNode::Regexp(_, _) => Some(self.descriptor()),
            _ => None,
        }
    }

    pub fn is_recovery_node(&self) -> bool {
        self.provenance.authored
            && matches!(
                self.provenance.program.nodes[self.provenance.index],
                PatternNode::Recover(..)
            )
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FailureDiagnostic {
    pub kind: PatternKind,
    pub position: usize,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Frame<'gc> {
    Match(usize, Scope<'gc>),
    Forward(Scope<'gc>),
    Resolve(Scope<'gc>),
    ProjectionPending {
        start: Scope<'gc>,
        expression: CompiledExpression,
    },
    Projection {
        start: Scope<'gc>,
        child: Gc<'gc, PatternMatch<'gc>>,
        execution: Gc<'gc, RefLock<ExpressionExecution<'gc>>>,
    },
    Pipeline(PipelineState<'gc>),
    IntoDrain {
        start: Scope<'gc>,
        node: usize,
        value: Value<'gc>,
        execution: Gc<'gc, RefLock<ExpressionExecution<'gc>>>,
    },
    Into {
        start: Scope<'gc>,
        length: usize,
        source: Option<crate::runtime::input::InputSource<'gc>>,
    },
    Recover {
        start: Scope<'gc>,
        skip: usize,
    },
    RecoverSkip {
        start: Scope<'gc>,
        failure: Gc<'gc, PatternMatch<'gc>>,
    },
    Over(OverState<'gc>),
    Variable(Rc<str>, Scope<'gc>),
    Unary(Unary, Scope<'gc>),
    Sequence {
        #[collect(require_static)]
        nodes: Rc<[usize]>,
        index: usize,
        start: Scope<'gc>,
        current: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
        values: Vec<Value<'gc>>,
    },
    And {
        #[collect(require_static)]
        nodes: Rc<[usize]>,
        index: usize,
        start: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    },
    Choice {
        #[collect(require_static)]
        nodes: Rc<[usize]>,
        index: usize,
        start: Scope<'gc>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
        /// Index in `children` of the first recovered success, if one is waiting
        /// for a later clean alternative.
        recovered: Option<usize>,
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
struct PipelineState<'gc> {
    #[collect(require_static)]
    nodes: Rc<[usize]>,
    stage: usize,
    start: Scope<'gc>,
    outer_end: usize,
    children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    last: Option<Gc<'gc, PatternMatch<'gc>>>,
    input: Option<Value<'gc>>,
    drain: Option<Gc<'gc, RefLock<ExpressionExecution<'gc>>>>,
    /// Whether the input of the stage being matched is open (a stage that read
    /// an open input to its end feeds an open input to the next stage).
    stage_open: bool,
    /// Length of the input of the stage being matched.
    stage_len: usize,
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
    pending_request: Option<PatternRequest<'gc>>,
    external: DynamicRootSet<'gc>,
}

#[derive(Clone, Collect)]
#[collect(no_drop)]
pub struct PatternRequest<'gc> {
    pub target_kind: ResolveTargetKind,
    pub name: Option<String>,
    pub value: Option<String>,
    #[collect(require_static)]
    pub special: Option<ResolveValue>,
    pub argument_count: usize,
    arguments: Vec<usize>,
    pattern_index: usize,
    pub stream: crate::runtime::input::InputBuffer<'gc>,
    pub source: Option<crate::runtime::input::InputSource<'gc>>,
    pub identity: InputIdentity<'gc>,
    pub position: usize,
    pub environment: Environment<'gc>,
    pub base: usize,
    pub recovery: RecoveryContext<'gc>,
    /// The input may continue past its last item (see `PatternExecution::new_open`).
    pub open: bool,
    #[collect(require_static)]
    program: Rc<PatternProgram>,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct PatternInput<'gc> {
    pub stream: crate::runtime::input::InputBuffer<'gc>,
    pub source: Option<crate::runtime::input::InputSource<'gc>>,
    pub identity: InputIdentity<'gc>,
    pub position: usize,
    pub base: usize,
    pub recovery: RecoveryContext<'gc>,
    /// The input may continue past its last item (see `PatternExecution::new_open`).
    pub open: bool,
}

impl<'gc> PatternRequest<'gc> {
    pub fn input(&self) -> PatternInput<'gc> {
        PatternInput {
            stream: self.stream,
            source: self.source,
            identity: self.identity,
            position: self.position,
            base: self.base,
            recovery: self.recovery,
            open: self.open,
        }
    }

    pub fn cursor(&self) -> InputPosition {
        self.identity.position(self.position)
    }

    pub fn program_identity(&self) -> usize {
        Rc::as_ptr(&self.program) as usize
    }

    pub fn argument_program(&self, index: usize) -> Result<PatternArgument, PatternError> {
        let root = *self
            .arguments
            .get(index)
            .ok_or(PatternError::InvalidArgument(format!(
                "Resolve argument index {index} is out of bounds"
            )))?;
        Ok(PatternArgument {
            program: self.program.clone(),
            root,
        })
    }

    pub(crate) fn rule_execution(
        &self,
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        environment: Environment<'gc>,
    ) -> PatternExecution<'gc> {
        PatternExecution::compiled_on_input(mc, program, self.input(), environment, 0)
    }

    pub fn argument_execution(
        &self,
        mc: &Mutation<'gc>,
        argument: &PatternArgument,
        environment: Environment<'gc>,
    ) -> PatternExecution<'gc> {
        argument.execution_on_input(mc, self.input(), environment)
    }
}

#[derive(Clone)]
pub struct PatternArgument {
    program: Rc<PatternProgram>,
    root: usize,
}

impl PatternArgument {
    pub fn identity(&self) -> (usize, usize) {
        (Rc::as_ptr(&self.program) as usize, self.root)
    }

    pub fn resolve_info(&self) -> Option<ResolveInfo> {
        match self.program.nodes.get(self.root)? {
            PatternNode::Resolve {
                target_kind,
                name,
                args,
                ..
            } => Some(ResolveInfo {
                target_kind: *target_kind,
                name: name.as_ref().map(|name| name.to_string()),
                argument_count: args.len(),
            }),
            _ => None,
        }
    }

    pub fn execution<'gc>(
        &self,
        mc: &Mutation<'gc>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        base: usize,
    ) -> PatternExecution<'gc> {
        let stream: Gc<'gc, Vec<Value<'gc>>> = Gc::new(
            mc,
            input
                .into_iter()
                .enumerate()
                .map(|(index, value)| {
                    value.wrap(
                        mc,
                        value.origin().unwrap_or(Origin {
                            start: base + index,
                            end: base + index + 1,
                        }),
                    )
                })
                .collect(),
        );
        self.execution_on_input(
            mc,
            PatternInput {
                stream: stream.into(),
                source: None,
                identity: InputIdentity::root(stream),
                position: 0,
                base,
                recovery: RecoveryContext::new(mc),
                open: false,
            },
            environment,
        )
    }

    pub fn execution_on_input<'gc>(
        &self,
        mc: &Mutation<'gc>,
        input: PatternInput<'gc>,
        environment: Environment<'gc>,
    ) -> PatternExecution<'gc> {
        PatternExecution::compiled_on_input(mc, self.program.clone(), input, environment, self.root)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolveInfo {
    pub target_kind: ResolveTargetKind,
    pub name: Option<String>,
    pub argument_count: usize,
}

impl<'gc> PatternExecution<'gc> {
    fn provenance(&self, scope: Scope<'gc>) -> PatternProvenance<'gc> {
        PatternProvenance {
            input: scope.source.map_or(scope.input, |source| source.prefix()),
            position: scope.position,
            base: scope.base,
            program: self.program.clone(),
            index: scope.pattern_index,
            authored: true,
            rule_arguments: None,
        }
    }

    pub(crate) fn root_input(
        &self,
    ) -> Option<(InputIdentity<'gc>, crate::runtime::input::InputBuffer<'gc>)> {
        match self.frames.first()? {
            Frame::Match(_, scope) => Some((scope.identity, scope.input)),
            _ => None,
        }
    }

    pub fn new(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
    ) -> Self {
        Self::compiled(mc, PatternProgram::compile(pattern), input, environment, 0)
    }

    pub fn new_with_recovery(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        recovery: RecoveryContext<'gc>,
    ) -> Self {
        Self::compiled_with_recovery(
            mc,
            PatternProgram::compile(pattern),
            input,
            environment,
            0,
            recovery,
        )
    }

    pub fn new_open(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
    ) -> Self {
        let mut execution = Self::new(mc, pattern, input, environment);
        execution.set_open();
        execution
    }

    /// Marks the root input as open: a prefix of a longer input still being
    /// written (for example the text before an editor's cursor). Exhausting an
    /// open input is not the end of the input, so patterns that stop at the end
    /// (repetition) still attempt their next element there.
    pub fn set_open(&mut self) {
        if let Some(Frame::Match(_, scope)) = self.frames.last_mut() {
            scope.open = true;
        }
    }

    pub fn from_input(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        input: PatternInput<'gc>,
        environment: Environment<'gc>,
    ) -> Self {
        Self::compiled_on_input(mc, PatternProgram::compile(pattern), input, environment, 0)
    }

    pub(crate) fn compiled(
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        base: usize,
    ) -> Self {
        Self::compiled_with_recovery(
            mc,
            program,
            input,
            environment,
            base,
            RecoveryContext::new(mc),
        )
    }

    pub(crate) fn compiled_with_recovery(
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        base: usize,
        recovery: RecoveryContext<'gc>,
    ) -> Self {
        Self::compiled_at_with_recovery(mc, program, input, environment, base, 0, recovery)
    }

    fn compiled_at_with_recovery(
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        input: Vec<Value<'gc>>,
        environment: Environment<'gc>,
        base: usize,
        root: usize,
        recovery: RecoveryContext<'gc>,
    ) -> Self {
        let input = Gc::new(
            mc,
            input
                .into_iter()
                .enumerate()
                .map(|(index, value)| {
                    value.wrap(
                        mc,
                        value.origin().unwrap_or(Origin {
                            start: base + index,
                            end: base + index + 1,
                        }),
                    )
                })
                .collect(),
        );
        let identity = InputIdentity::root(input);
        Self::compiled_on_input(
            mc,
            program,
            PatternInput {
                stream: input.into(),
                source: None,
                identity,
                position: 0,
                base,
                recovery,
                open: false,
            },
            environment,
            root,
        )
    }

    fn compiled_on_input(
        mc: &Mutation<'gc>,
        program: Rc<PatternProgram>,
        input: PatternInput<'gc>,
        environment: Environment<'gc>,
        root: usize,
    ) -> Self {
        let scope = Scope {
            input: input.stream,
            source: input.source,
            identity: input.identity,
            recovery: input.recovery,
            position: input.position,
            environment,
            base: input.base,
            open: input.open,
            pattern_index: 0,
        };
        Self {
            program,
            frames: vec![Frame::Match(root, scope)],
            result: None,
            error: None,
            pending_request: None,
            external: DynamicRootSet::new(mc),
        }
    }

    pub fn take_request(&self) -> Option<PatternRequest<'gc>> {
        self.pending_request.clone().or_else(|| {
            self.frames.iter().rev().find_map(|frame| match frame {
                Frame::Projection { execution, .. } => execution.borrow().take_request(),
                Frame::Pipeline(state) => state
                    .drain
                    .as_ref()
                    .and_then(|execution| execution.borrow().take_request()),
                Frame::IntoDrain { execution, .. } => execution.borrow().take_request(),
                _ => None,
            })
        })
    }

    pub(crate) fn set_external(&mut self, external: DynamicRootSet<'gc>) {
        self.external = external;
    }

    pub fn from_source(
        mc: &Mutation<'gc>,
        pattern: Pattern,
        source: crate::runtime::input::InputSource<'gc>,
        environment: Environment<'gc>,
    ) -> Self {
        Self::compiled_on_input(
            mc,
            PatternProgram::compile(pattern),
            PatternInput {
                stream: source.prefix(),
                source: Some(source),
                identity: source.identity(),
                position: 0,
                base: 0,
                recovery: RecoveryContext::new(mc),
                open: false,
            },
            environment,
            0,
        )
    }

    pub(crate) fn set_source(&mut self, source: crate::runtime::input::InputSource<'gc>) {
        if let Some(Frame::Match(_, scope)) = self.frames.first_mut() {
            scope.source = Some(source);
            scope.input = source.prefix();
            scope.identity = source.identity();
        }
    }

    fn input_source(&self) -> Option<crate::runtime::input::InputSource<'gc>> {
        self.frames.iter().rev().find_map(|frame| match frame {
            Frame::Match(_, scope) => scope.source.filter(|source| source.pending()),
            Frame::Into { source, .. } => source.filter(|source| source.pending()),
            _ => None,
        })
    }

    pub fn input_pending(&self) -> bool {
        self.input_source().is_some()
            || self
                .host_execution_all()
                .is_some_and(|execution| execution.borrow().input_pending())
    }

    fn host_execution_all(&self) -> Option<Gc<'gc, RefLock<ExpressionExecution<'gc>>>> {
        self.frames.iter().rev().find_map(|frame| {
            let execution = match frame {
                Frame::Projection { execution, .. } | Frame::IntoDrain { execution, .. } => {
                    Some(*execution)
                }
                Frame::Pipeline(state) => state.drain,
                _ => None,
            }?;
            (execution.borrow().host_pending() || execution.borrow().input_pending())
                .then_some(execution)
        })
    }

    pub fn take_input_request(
        &mut self,
        mc: &Mutation<'gc>,
    ) -> Option<crate::runtime::input::InputRequest> {
        if let Some(source) = self.input_source() {
            return source.take_request(mc, self.external);
        }
        self.host_execution_all()?
            .borrow_mut(mc)
            .take_input_request(mc)
    }

    pub fn complete_input(
        &mut self,
        mc: &Mutation<'gc>,
        request: &crate::runtime::input::InputRequest,
        completion: Result<crate::runtime::input::InputCompletion, String>,
    ) -> Result<(), PatternError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let outcome = if let Some(source) = self.input_source() {
            source.complete(mc, self.external, request, completion)
        } else if let Some(execution) = self.host_execution_all() {
            execution
                .borrow_mut(mc)
                .complete_input(mc, request, completion)
        } else {
            Err(EvaluationError::StaleInputRequest)
        };
        if let Err(error) = &outcome
            && !crate::evaluate::is_stale_request(error)
        {
            self.fail(pattern_expression_error(error.clone()));
        }
        outcome.map_err(pattern_expression_error)
    }

    fn host_execution(&self) -> Option<Gc<'gc, RefLock<ExpressionExecution<'gc>>>> {
        self.frames.iter().rev().find_map(|frame| {
            let execution = match frame {
                Frame::Projection { execution, .. } | Frame::IntoDrain { execution, .. } => {
                    Some(*execution)
                }
                Frame::Pipeline(state) => state.drain,
                _ => None,
            }?;
            execution.borrow().host_pending().then_some(execution)
        })
    }

    pub fn host_pending(&self) -> bool {
        self.host_execution().is_some()
    }

    pub fn take_host_request(&mut self, mc: &Mutation<'gc>) -> Option<HostRequest> {
        self.host_execution()?.borrow_mut(mc).take_host_request(mc)
    }

    pub fn fetch_rooted(&self, root: &RootedValue) -> Result<Value<'gc>, EvaluationError> {
        root.fetch(self.external)
    }

    pub fn complete_host(
        &mut self,
        mc: &Mutation<'gc>,
        request: &HostRequest,
        completion: Result<HostCompletion, String>,
    ) -> Result<(), PatternError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        let execution = self
            .host_execution()
            .ok_or_else(|| pattern_expression_error(EvaluationError::StaleHostRequest))?;
        let outcome = execution
            .borrow_mut(mc)
            .complete_host(mc, request, completion);
        if let Err(error) = &outcome
            && !crate::evaluate::is_stale_request(error)
        {
            self.fail(pattern_expression_error(error.clone()));
        }
        outcome.map_err(pattern_expression_error)
    }

    fn fail(&mut self, error: PatternError) {
        self.error = Some(error);
        self.frames.clear();
        self.result = None;
        self.pending_request = None;
    }

    pub fn cancel(&mut self) {
        if self.error.is_none() {
            self.fail(pattern_expression_error(EvaluationError::Cancelled));
        }
    }

    pub fn step_status(&mut self, mc: &Mutation<'gc>) -> Result<StepStatus, PatternError> {
        if self.step(mc)? {
            Ok(StepStatus::Complete)
        } else if self.host_pending() || self.input_pending() || self.take_request().is_some() {
            Ok(StepStatus::Suspended)
        } else {
            Ok(StepStatus::Yielded)
        }
    }

    pub fn resume_resolve(
        &mut self,
        mc: &Mutation<'gc>,
        outcome: Gc<'gc, PatternMatch<'gc>>,
    ) -> Result<(), PatternError> {
        if self.pending_request.is_some() {
            let Some(Frame::Resolve(scope)) = self.frames.pop() else {
                return Err(PatternError::InvalidState);
            };
            self.pending_request = None;
            let succeeded = outcome.kind != MatchKind::Fail;
            let end = if succeeded {
                outcome.end
            } else {
                scope.position
            };
            self.result = Some(Gc::new(
                mc,
                PatternMatch {
                    kind: outcome.kind,
                    value: if succeeded {
                        outcome.value
                    } else {
                        Value::Undefined
                    },
                    start: scope.position,
                    end,
                    environment: if succeeded {
                        outcome.environment
                    } else {
                        scope.environment
                    },
                    origin: span(scope, end),
                    children: MatchChildren::one(outcome),
                    pattern_index: scope.pattern_index,
                    pattern_kind: self.program.nodes[scope.pattern_index].kind(),
                    provenance: self.provenance(scope),
                    identity: scope.identity,
                    seeded: outcome.seeded,
                    recovered: outcome.recovered,
                    recovery: outcome.recovery,
                    rule: None,
                },
            ));
            return Ok(());
        }
        for frame in self.frames.iter_mut().rev() {
            match frame {
                Frame::Projection { execution, .. }
                    if execution.borrow().take_request().is_some() =>
                {
                    return execution
                        .borrow_mut(mc)
                        .resume_resolve(mc, outcome)
                        .map_err(pattern_expression_error);
                }
                Frame::Pipeline(state)
                    if state
                        .drain
                        .as_ref()
                        .is_some_and(|execution| execution.borrow().take_request().is_some()) =>
                {
                    return state
                        .drain
                        .as_ref()
                        .ok_or(PatternError::InvalidState)?
                        .borrow_mut(mc)
                        .resume_resolve(mc, outcome)
                        .map_err(pattern_expression_error);
                }
                Frame::IntoDrain { execution, .. }
                    if execution.borrow().take_request().is_some() =>
                {
                    return execution
                        .borrow_mut(mc)
                        .resume_resolve(mc, outcome)
                        .map_err(pattern_expression_error);
                }
                _ => {}
            }
        }
        Err(PatternError::InvalidState)
    }

    pub fn result(&self) -> Option<Gc<'gc, PatternMatch<'gc>>> {
        if self.frames.is_empty() {
            self.result
        } else {
            None
        }
    }

    /// Returns the furthest failed node retained in the match tree without
    /// changing the match result's consumption or rollback behavior.
    pub fn rightmost_failure(&self) -> Option<FailureDiagnostic> {
        let root = self.result?;
        if root.kind != MatchKind::Fail {
            return None;
        }
        let mut rightmost = root;
        let mut pending: Vec<_> = root.children.iter().rev().copied().collect();
        while let Some(node) = pending.pop() {
            if node.kind == MatchKind::Fail && node.start > rightmost.start {
                rightmost = node;
            }
            pending.extend(node.children.iter().rev().copied());
        }
        Some(FailureDiagnostic {
            kind: rightmost.pattern_kind,
            position: rightmost.start,
        })
    }

    pub fn step(&mut self, mc: &Mutation<'gc>) -> Result<bool, PatternError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        if self.host_pending() || self.input_pending() {
            return Ok(false);
        }
        let result = self.execute(mc);
        if let Err(error) = &result {
            self.fail(error.clone());
        }
        result
    }

    fn execute(&mut self, mc: &Mutation<'gc>) -> Result<bool, PatternError> {
        if self.pending_request.is_some() {
            return Ok(false);
        }
        let Some(frame) = self.frames.pop() else {
            return Ok(true);
        };
        match frame {
            Frame::Match(index, mut scope) => {
                if let Some(source) = scope.source {
                    scope.input = source.prefix();
                    let needs_item = match &self.program.nodes[index] {
                        PatternNode::Ok
                        | PatternNode::Fail
                        | PatternNode::Projection(..)
                        | PatternNode::Pipeline(..)
                        | PatternNode::Resolve { .. }
                        | PatternNode::Variable(..)
                        | PatternNode::And(..)
                        | PatternNode::Then(..)
                        | PatternNode::Or(..)
                        | PatternNode::Recover(..) => false,
                        PatternNode::Unary(unary, _) => {
                            matches!(unary, Unary::Into | Unary::Except)
                        }
                        PatternNode::Quantifier(..) => false,
                        _ => true,
                    };
                    if needs_item
                        && !source
                            .require(mc, scope.position)
                            .map_err(pattern_expression_error)?
                    {
                        self.frames.push(Frame::Match(index, scope));
                        return Ok(false);
                    }
                    scope.input = source.prefix();
                }
                scope.pattern_index = index;
                match &self.program.nodes[index] {
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
                    PatternNode::Fail => {
                        self.set(mc, scope, false, false, Value::Undefined, vec![])
                    }
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
                            return Err(PatternError::DuplicateVariable(name.to_string()));
                        }
                        self.frames.push(Frame::Variable(Rc::clone(name), scope));
                        self.frames.push(Frame::Match(*child, scope));
                    }
                    PatternNode::Between(left, right) => {
                        if left.is_none() && right.is_none() {
                            return Err(PatternError::InvalidBound(
                                "between requires at least one bound (L..R, L.., or ..R)".into(),
                            ));
                        }
                        let left = left
                            .as_ref()
                            .map(|source| ordered_source(source, scope))
                            .transpose()?;
                        let right = right
                            .as_ref()
                            .map(|source| ordered_source(source, scope))
                            .transpose()?;
                        let value = scope.input.get(scope.position).copied();
                        let matched = match value {
                            Some(value) => in_interval(mc, left.as_ref(), right.as_ref(), value)?,
                            None => false,
                        };
                        self.set(
                            mc,
                            scope,
                            matched,
                            true,
                            value.unwrap_or(Value::Undefined),
                            vec![],
                        );
                    }
                    PatternNode::And(nodes) => {
                        if let Some(first) = nodes.first() {
                            self.frames.push(Frame::And {
                                nodes: nodes.clone(),
                                index: 0,
                                start: scope,
                                children: vec![],
                            });
                            self.frames.push(Frame::Match(*first, scope));
                        } else {
                            self.set(mc, scope, true, false, Value::Undefined, vec![]);
                        }
                    }
                    PatternNode::Character(character_class, expression) => {
                        let Some(value) = scope.input.get(scope.position).copied() else {
                            self.set(mc, scope, false, true, Value::Undefined, vec![]);
                            return Ok(self.frames.is_empty());
                        };
                        let Value::String(text) = value.raw() else {
                            return Err(PatternError::TypeError(format!(
                                "expected value to be a string for character class but got {}",
                                format!("{:?}", value.runtime_type()).to_lowercase()
                            )));
                        };
                        let Some(expression) = expression else {
                            return Err(PatternError::InvalidArgument(format!(
                                "unknown character class {character_class}"
                            )));
                        };
                        self.set(
                            mc,
                            scope,
                            character_class_matches(expression, &text),
                            true,
                            value,
                            vec![],
                        );
                    }
                    PatternNode::Regexp(spec, expression) => {
                        let Some(value) = scope.input.get(scope.position).copied() else {
                            self.set(mc, scope, false, true, Value::Undefined, vec![]);
                            return Ok(self.frames.is_empty());
                        };
                        let Value::String(text) = value.raw() else {
                            return Err(PatternError::TypeError(format!(
                                "expected value to be a string but got {}",
                                value.runtime_type()
                            )));
                        };
                        let compiled;
                        let expression = match expression {
                            Some(expression) => expression.as_ref(),
                            None => {
                                compiled = compile_regexp_spec(spec)?;
                                compiled.as_ref()
                            }
                        };
                        self.set(
                            mc,
                            scope,
                            expression
                                .find_from_utf16(text.as_utf16(), 0)
                                .next()
                                .is_some(),
                            true,
                            value,
                            vec![],
                        );
                    }
                    PatternNode::Resolve {
                        target_kind,
                        name,
                        args,
                        value,
                    } => {
                        let base = scope
                            .input
                            .get(scope.position)
                            .and_then(|item| item.origin())
                            .map_or(scope.base, |origin| origin.start);
                        self.pending_request = Some(PatternRequest {
                            target_kind: *target_kind,
                            name: name.as_ref().map(|name| name.to_string()),
                            value: value.as_ref().and_then(ResolveValue::json_text),
                            special: value.clone(),
                            argument_count: args.len(),
                            arguments: args.to_vec(),
                            pattern_index: scope.pattern_index,
                            stream: scope.input,
                            source: scope.source,
                            identity: scope.identity,
                            position: scope.position,
                            environment: scope.environment,
                            base,
                            recovery: scope.recovery,
                            open: scope.open,
                            program: self.program.clone(),
                        });
                        self.frames.push(Frame::Resolve(scope));
                    }
                    PatternNode::Projection(node, expression) => {
                        self.frames.push(Frame::ProjectionPending {
                            start: scope,
                            expression: expression.clone(),
                        });
                        self.frames.push(Frame::Match(*node, scope));
                    }
                    PatternNode::Pipeline(nodes) => {
                        if let Some(first) = nodes.first() {
                            self.frames.push(Frame::Pipeline(PipelineState {
                                nodes: nodes.clone(),
                                stage: 0,
                                start: scope,
                                outer_end: scope.position,
                                children: vec![],
                                last: None,
                                input: None,
                                drain: None,
                                stage_open: scope.open,
                                stage_len: scope.input.len(),
                            }));
                            self.frames.push(Frame::Match(*first, scope));
                        } else {
                            self.set(mc, scope, true, false, Value::Undefined, vec![]);
                        }
                    }
                    PatternNode::Recover(node, skip) => {
                        self.frames.push(Frame::Recover {
                            start: scope,
                            skip: *skip,
                        });
                        self.frames.push(Frame::Match(*node, scope));
                    }
                    PatternNode::Over(declared, rest) => {
                        let Some(source) = scope.input.get(scope.position).copied() else {
                            self.set(mc, scope, false, false, Value::Undefined, vec![]);
                            return Ok(self.frames.is_empty());
                        };
                        let entries = keyed_entries(mc, source)?;
                        let remaining = entries
                            .into_iter()
                            .filter(|(key, _)| {
                                !declared.iter().any(|(name, _)| {
                                matches!(key.raw(), Value::String(value) if *value == *name)
                            })
                            })
                            .collect();
                        let state = OverState {
                            start: scope,
                            source,
                            fields: remaining,
                            declared: declared.clone(),
                            rest: rest.clone(),
                            fixed_index: 0,
                            entry_index: 0,
                            clause_index: 0,
                            stage: OverStage::Fixed,
                            environment: scope.environment,
                            children: vec![],
                            captures: vec![],
                        };
                        self.schedule_over(mc, state)?;
                    }
                    PatternNode::Switch(cases, default) => {
                        let value = scope.input.get(scope.position).copied();
                        let mut selected = None;
                        if let Some(value) = value {
                            for (key, child) in cases {
                                let matches = match key {
                                    SwitchKey::Values { values } => {
                                        let mut matched = false;
                                        for source in values {
                                            if equal(source, scope, false)? {
                                                matched = true;
                                                break;
                                            }
                                        }
                                        matched
                                    }
                                    SwitchKey::CharacterClass { character_class } => {
                                        let expression = character_class_regex(character_class)?;
                                        let Value::String(text) = value.raw() else {
                                            return Err(PatternError::TypeError(format!(
                                                "expected value to be a string for character class but got {}",
                                                format!("{:?}", value.runtime_type())
                                                    .to_lowercase()
                                            )));
                                        };
                                        character_class_matches(&expression, &text)
                                    }
                                };
                                if matches {
                                    selected = Some(*child);
                                    break;
                                }
                            }
                        }
                        if let Some(child) = selected.or(*default) {
                            self.frames.push(Frame::Forward(scope));
                            self.frames.push(Frame::Match(child, scope));
                        } else {
                            self.set(mc, scope, false, false, Value::Undefined, vec![]);
                        }
                    }
                    PatternNode::Unary(unary, child) => {
                        if matches!(unary, Unary::Into) {
                            let Some(value) = scope.input.get(scope.position).copied() else {
                                self.set(mc, scope, false, false, Value::Undefined, vec![]);
                                return Ok(self.frames.is_empty());
                            };
                            if let Value::InputSource(source) = value.raw() {
                                let mut inner = scope;
                                inner.source = Some(source);
                                inner.input = source.prefix();
                                inner.identity =
                                    source
                                        .identity()
                                        .nested(mc, scope.position, PathSegment::Into);
                                inner.position = 0;
                                inner.open = false;
                                self.frames.push(Frame::Into {
                                    start: scope,
                                    length: 0,
                                    source: Some(source),
                                });
                                self.frames.push(Frame::Match(*child, inner));
                                return Ok(false);
                            }
                            if !is_iterable_candidate(value) {
                                return Err(PatternError::IterableExpected);
                            }
                            let mut execution = ExpressionExecution::collect_iterable(
                                mc,
                                value,
                                scope.environment,
                                value.origin().unwrap_or(span(scope, scope.position + 1)),
                            )
                            .map_err(pattern_expression_error)?;
                            execution.set_recovery(scope.recovery);
                            execution.set_external(self.external);
                            self.frames.push(Frame::IntoDrain {
                                start: scope,
                                node: *child,
                                value,
                                execution: Gc::new(mc, RefLock::new(execution)),
                            });
                            return Ok(false);
                        }
                        if matches!(unary, Unary::Except) && scope.position == scope.input.len() {
                            self.set(mc, scope, false, false, Value::Undefined, vec![]);
                            return Ok(self.frames.is_empty());
                        }
                        let mut child_scope = scope;
                        if matches!(unary, Unary::Not | Unary::Lookahead | Unary::Except) {
                            child_scope.recovery = scope.recovery.disable();
                        }
                        self.frames.push(Frame::Unary(*unary, scope));
                        self.frames.push(Frame::Match(*child, child_scope));
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
                                recovered: None,
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
                        if max == 0.0
                            || (!scope.open
                                && scope.position == scope.input.len()
                                && scope.source.is_none_or(|source| source.is_eof()))
                        {
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
                }
            }
            Frame::Over(state) => self.resume_over(mc, state)?,
            Frame::Forward(start) => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                if child.kind == MatchKind::Fail {
                    self.set(mc, start, false, false, Value::Undefined, vec![child]);
                } else {
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            kind: child.kind,
                            value: child.value,
                            start: start.position,
                            end: child.end,
                            environment: child.environment,
                            origin: span(start, child.end),
                            children: MatchChildren::one(child),
                            pattern_index: start.pattern_index,
                            pattern_kind: self.program.nodes[start.pattern_index].kind(),
                            provenance: self.provenance(start),
                            identity: start.identity,
                            seeded: child.seeded,
                            recovered: child.recovered,
                            recovery: child.recovery,
                            rule: None,
                        },
                    ));
                }
            }
            Frame::Resolve(_) => return Err(PatternError::InvalidState),
            Frame::Recover { start, skip } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                if child.kind == MatchKind::Fail {
                    if child.seeded || !start.recovery.is_enabled() {
                        if !child.seeded {
                            start.recovery.record_failure(mc);
                        }
                        self.result = Some(Gc::new(
                            mc,
                            PatternMatch {
                                kind: MatchKind::Fail,
                                value: Value::Undefined,
                                start: start.position,
                                end: start.position,
                                environment: start.environment,
                                origin: span(start, start.position),
                                identity: start.identity,
                                seeded: child.seeded,
                                recovered: child.recovered,
                                recovery: start.recovery,
                                rule: None,
                                children: MatchChildren::one(child),
                                pattern_index: start.pattern_index,
                                pattern_kind: self.program.nodes[start.pattern_index].kind(),
                                provenance: self.provenance(start),
                            },
                        ));
                    } else {
                        let mut skip_scope = start;
                        skip_scope.position = child.end;
                        skip_scope.recovery = start.recovery.disable();
                        self.frames.push(Frame::RecoverSkip {
                            start,
                            failure: child,
                        });
                        self.frames.push(Frame::Match(skip, skip_scope));
                    }
                } else {
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            kind: child.kind,
                            value: child.value,
                            start: start.position,
                            end: child.end,
                            environment: child.environment,
                            origin: span(start, child.end),
                            identity: start.identity,
                            seeded: child.seeded,
                            recovered: child.recovered,
                            recovery: child.recovery,
                            rule: None,
                            children: MatchChildren::one(child),
                            pattern_index: start.pattern_index,
                            pattern_kind: self.program.nodes[start.pattern_index].kind(),
                            provenance: self.provenance(start),
                        },
                    ));
                }
            }
            Frame::RecoverSkip { start, failure } => {
                let skip = self.result.take().ok_or(PatternError::InvalidState)?;
                if skip.kind != MatchKind::Fail && skip.end > failure.end {
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            kind: skip.kind,
                            value: skip.value,
                            start: start.position,
                            end: skip.end,
                            environment: skip.environment,
                            origin: span(start, skip.end),
                            identity: start.identity,
                            seeded: false,
                            recovered: true,
                            recovery: start.recovery.enable(),
                            rule: None,
                            children: MatchChildren::two(failure, skip),
                            pattern_index: start.pattern_index,
                            pattern_kind: self.program.nodes[start.pattern_index].kind(),
                            provenance: self.provenance(start),
                        },
                    ));
                } else {
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            kind: MatchKind::Fail,
                            value: Value::Undefined,
                            start: start.position,
                            end: start.position,
                            environment: start.environment,
                            origin: span(start, start.position),
                            identity: start.identity,
                            seeded: false,
                            recovered: false,
                            recovery: start.recovery,
                            rule: None,
                            children: MatchChildren::two(failure, skip),
                            pattern_index: start.pattern_index,
                            pattern_kind: self.program.nodes[start.pattern_index].kind(),
                            provenance: self.provenance(start),
                        },
                    ));
                }
            }
            Frame::ProjectionPending { start, expression } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                if child.kind == MatchKind::Fail {
                    self.set(mc, start, false, false, Value::Undefined, vec![child]);
                } else {
                    let mut execution =
                        ExpressionExecution::from_compiled_match(mc, &expression, child);
                    execution.set_recovery(start.recovery);
                    execution.set_external(self.external);
                    self.frames.push(Frame::Projection {
                        start,
                        child,
                        execution: Gc::new(mc, RefLock::new(execution)),
                    });
                }
            }
            Frame::Projection {
                start,
                child,
                execution,
            } => {
                if step_expression(mc, &mut execution.borrow_mut(mc))? {
                    let value = execution
                        .borrow()
                        .result()
                        .ok_or(PatternError::InvalidState)?;
                    self.result = Some(Gc::new(
                        mc,
                        PatternMatch {
                            // A projection builds its own value, so a skipped child
                            // is still an ordinary success.
                            kind: MatchKind::Ok,
                            value,
                            start: start.position,
                            end: child.end,
                            environment: child.environment,
                            origin: span(start, child.end),
                            children: MatchChildren::one(child),
                            pattern_index: start.pattern_index,
                            pattern_kind: self.program.nodes[start.pattern_index].kind(),
                            provenance: self.provenance(start),
                            identity: start.identity,
                            seeded: child.seeded,
                            recovered: child.recovered,
                            recovery: child.recovery,
                            rule: None,
                        },
                    ));
                } else {
                    self.frames.push(Frame::Projection {
                        start,
                        child,
                        execution,
                    });
                }
            }
            Frame::Pipeline(state) => self.resume_pipeline(mc, state)?,
            Frame::IntoDrain {
                start,
                node,
                value,
                execution,
            } => {
                if !step_expression(mc, &mut execution.borrow_mut(mc))? {
                    self.frames.push(Frame::IntoDrain {
                        start,
                        node,
                        value,
                        execution,
                    });
                } else {
                    let iterable = execution
                        .borrow()
                        .result()
                        .ok_or(PatternError::InvalidState)?;
                    let Value::Array(values) = iterable.raw() else {
                        return Err(PatternError::InvalidState);
                    };
                    let input = Gc::new(mc, values.borrow().clone());
                    let mut inner = start;
                    inner.input = input.into();
                    inner.source = None;
                    inner.identity = start.identity.nested(mc, start.position, PathSegment::Into);
                    inner.position = 0;
                    inner.base = value.origin().map_or(start.base, |origin| origin.start);
                    inner.open = start.open && start.position + 1 == start.input.len();
                    self.frames.push(Frame::Into {
                        start,
                        length: input.len(),
                        source: None,
                    });
                    self.frames.push(Frame::Match(node, inner));
                }
            }
            Frame::Into {
                start,
                mut length,
                source,
            } => {
                if let Some(source) = source {
                    let child = self.result.as_ref().ok_or(PatternError::InvalidState)?;
                    if child.kind != MatchKind::Fail
                        && !source
                            .require(mc, child.end)
                            .map_err(pattern_expression_error)?
                    {
                        self.frames.push(Frame::Into {
                            start,
                            length,
                            source: Some(source),
                        });
                        return Ok(false);
                    }
                    length = source.prefix().len();
                }
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                let complete = child.kind != MatchKind::Fail && child.end == length;
                let end = if complete {
                    start.position + 1
                } else {
                    start.position
                };
                self.result = Some(Gc::new(
                    mc,
                    PatternMatch {
                        kind: if complete {
                            child.kind
                        } else {
                            MatchKind::Fail
                        },
                        value: if complete {
                            child.value
                        } else {
                            Value::Undefined
                        },
                        start: start.position,
                        end,
                        environment: if complete {
                            child.environment
                        } else {
                            start.environment
                        },
                        origin: span(start, end),
                        identity: start.identity,
                        seeded: child.seeded,
                        recovered: child.recovered,
                        recovery: child.recovery,
                        rule: None,
                        children: MatchChildren::one(child),
                        pattern_index: start.pattern_index,
                        pattern_kind: self.program.nodes[start.pattern_index].kind(),
                        provenance: self.provenance(start),
                    },
                ));
            }
            Frame::Variable(name, start) => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                let environment = if child.kind == MatchKind::Fail {
                    start.environment
                } else {
                    Environment::new(
                        mc,
                        Some(child.environment),
                        vec![(Rc::clone(&name), child.value)],
                    )
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
                        children: MatchChildren::one(child),
                        pattern_index: start.pattern_index,
                        pattern_kind: self.program.nodes[start.pattern_index].kind(),
                        provenance: self.provenance(start),
                        identity: start.identity,
                        seeded: child.seeded,
                        recovered: child.recovered,
                        recovery: child.recovery,
                        rule: None,
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
                    children: MatchChildren::one(child),
                    pattern_index: start.pattern_index,
                    pattern_kind: self.program.nodes[start.pattern_index].kind(),
                    provenance: self.provenance(start),
                    identity: start.identity,
                    seeded: child.seeded,
                    recovered: child.recovered,
                    recovery: child.recovery,
                    rule: None,
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
                        result.recovery = start.recovery;
                    }
                    Unary::Lookahead => {
                        result.kind = if matched {
                            MatchKind::Ok
                        } else {
                            MatchKind::Fail
                        };
                        result.end = start.position;
                        result.environment = start.environment;
                        result.recovery = start.recovery;
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
                            Value::String(value) => value.code_points().count(),
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
                        result.recovery = start.recovery;
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
                    if let Some(source) = current.source {
                        current.input = source.prefix();
                    }
                    current.environment = child.environment;
                    current.recovery = child.recovery;
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
                                pattern_index: start.pattern_index,
                                pattern_kind: self.program.nodes[start.pattern_index].kind(),
                                provenance: self.provenance(start),
                                identity: start.identity,
                                seeded: false,
                                recovered: children.iter().any(|child| child.recovered),
                                recovery: current.recovery,
                                rule: None,
                                children: children.into(),
                            },
                        ));
                    }
                }
            }
            Frame::And {
                nodes,
                index,
                start,
                mut children,
            } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                children.push(child);
                if child.kind == MatchKind::Fail {
                    self.set(mc, start, false, false, Value::Undefined, children);
                } else {
                    let environment = child.environment;
                    if let Some(next) = nodes.get(index + 1).copied() {
                        let mut child_scope = start;
                        child_scope.environment = environment;
                        child_scope.recovery = child.recovery;
                        self.frames.push(Frame::And {
                            nodes,
                            index: index + 1,
                            start,
                            children,
                        });
                        self.frames.push(Frame::Match(next, child_scope));
                    } else {
                        let origin = span(start, child.end);
                        self.result = Some(Gc::new(
                            mc,
                            PatternMatch {
                                kind: child.kind,
                                value: child.value,
                                start: start.position,
                                end: child.end,
                                environment,
                                origin,
                                pattern_index: start.pattern_index,
                                pattern_kind: self.program.nodes[start.pattern_index].kind(),
                                provenance: self.provenance(start),
                                identity: start.identity,
                                seeded: false,
                                recovered: children.iter().any(|child| child.recovered),
                                recovery: child.recovery,
                                rule: None,
                                children: children.into(),
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
                mut recovered,
            } => {
                let child = self.result.take().ok_or(PatternError::InvalidState)?;
                let clean = child.kind != MatchKind::Fail && !child.recovered;
                children.push(child);
                if clean {
                    if let Some(kept) = recovered {
                        let success = children[kept];
                        children[kept] = self.rejected_alternative(mc, start, nodes[kept], success);
                    }
                    self.finish_choice(mc, start, child, children);
                } else {
                    if child.kind != MatchKind::Fail && child.recovered {
                        if recovered.is_some() {
                            let success = children.pop().ok_or(PatternError::InvalidState)?;
                            children.push(self.rejected_alternative(
                                mc,
                                start,
                                nodes[index],
                                success,
                            ));
                        } else {
                            recovered = Some(index);
                        }
                    }
                    if let Some(next) = nodes.get(index + 1).copied() {
                        self.frames.push(Frame::Choice {
                            nodes,
                            index: index + 1,
                            start,
                            children,
                            recovered,
                        });
                        self.frames.push(Frame::Match(next, start));
                    } else if let Some(kept) = recovered {
                        let chosen = children[kept];
                        self.finish_choice(mc, start, chosen, children);
                    } else {
                        self.set(mc, start, false, false, Value::Undefined, children);
                    }
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
                    if let Some(source) = current.source {
                        current.input = source.prefix();
                    }
                    current.environment = child.environment;
                    if count as f64 >= max
                        || (!progress && count as f64 >= min.max(1.0))
                        || (!current.open
                            && current.position == current.input.len()
                            && current.source.is_none_or(|source| source.is_eof()))
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

    fn resume_over(
        &mut self,
        mc: &Mutation<'gc>,
        mut state: OverState<'gc>,
    ) -> Result<(), PatternError> {
        let child = self.result.take().ok_or(PatternError::InvalidState)?;
        state.children.push(child);
        match state.stage {
            OverStage::Fixed => {
                if child.kind == MatchKind::Fail {
                    self.set(
                        mc,
                        state.start,
                        false,
                        false,
                        Value::Undefined,
                        state.children,
                    );
                    return Ok(());
                }
                state.environment = child.environment;
                state.fixed_index += 1;
                if state.fixed_index >= state.declared.len() {
                    state.stage = OverStage::RestKey;
                }
            }
            OverStage::RestKey => {
                if child.kind == MatchKind::Fail {
                    state.clause_index += 1;
                    state.environment = state.start.environment;
                } else {
                    state.environment = child.environment;
                    state.stage = OverStage::RestValue;
                }
            }
            OverStage::RestValue => {
                if child.kind == MatchKind::Fail {
                    state.clause_index += 1;
                    state.environment = state.start.environment;
                    state.stage = OverStage::RestKey;
                } else {
                    let (key, value) = state.fields[state.entry_index];
                    let OverRestNode::Pattern {
                        entry,
                        key: key_node,
                        value: value_node,
                    } = &state.rest[state.clause_index]
                    else {
                        return Err(PatternError::InvalidState);
                    };
                    if let Some(name) = entry {
                        if state.start.environment.get(name).is_some() {
                            return Err(PatternError::DuplicateVariable(name.clone()));
                        }
                        push_capture(
                            &mut state.captures,
                            name.clone(),
                            Value::array(mc, vec![key, value]),
                        );
                    }
                    for name in self.variable_names(*key_node) {
                        if let Some(value) = child.environment.get(&name) {
                            push_capture(&mut state.captures, name, value);
                        }
                    }
                    for name in self.variable_names(*value_node) {
                        if let Some(value) = child.environment.get(&name) {
                            push_capture(&mut state.captures, name, value);
                        }
                    }
                    state.entry_index += 1;
                    state.clause_index = 0;
                    state.stage = OverStage::RestKey;
                    state.environment = state.start.environment;
                }
            }
        }
        self.schedule_over(mc, state)
    }

    fn resume_pipeline(
        &mut self,
        mc: &Mutation<'gc>,
        mut state: PipelineState<'gc>,
    ) -> Result<(), PatternError> {
        if let Some(drain) = state.drain.take() {
            if !step_expression(mc, &mut drain.borrow_mut(mc))? {
                state.drain = Some(drain);
                self.frames.push(Frame::Pipeline(state));
                return Ok(());
            }
            state.input = Some(drain.borrow().result().ok_or(PatternError::InvalidState)?);
            self.frames.push(Frame::Pipeline(state));
            return Ok(());
        }

        if let Some(input) = state.input.take() {
            let last = state.last.ok_or(PatternError::InvalidState)?;
            let stream = Gc::new(mc, vec![input]);
            let mut scope = state.start;
            scope.input = stream.into();
            scope.identity = InputIdentity::root(stream);
            scope.position = 0;
            scope.environment = last.environment;
            scope.recovery = last.recovery;
            scope.base = last.origin.start;
            scope.open = state.stage_open;
            scope.source = None;
            state.stage_len = 1;
            let node = *state
                .nodes
                .get(state.stage)
                .ok_or(PatternError::InvalidState)?;
            self.frames.push(Frame::Pipeline(state));
            self.frames.push(Frame::Match(node, scope));
            return Ok(());
        }

        let child = self.result.take().ok_or(PatternError::InvalidState)?;
        state.children.push(child);
        if child.kind == MatchKind::Fail {
            self.set(
                mc,
                state.start,
                false,
                false,
                Value::Undefined,
                state.children,
            );
            return Ok(());
        }
        if state.stage == 0 {
            state.outer_end = child.end;
        }
        state.last = Some(child);
        if state.stage + 1 == state.nodes.len() {
            self.result = Some(Gc::new(
                mc,
                PatternMatch {
                    kind: child.kind,
                    value: child.value,
                    start: state.start.position,
                    end: state.outer_end,
                    environment: child.environment,
                    origin: span(state.start, state.outer_end),
                    pattern_index: state.start.pattern_index,
                    pattern_kind: self.program.nodes[state.start.pattern_index].kind(),
                    provenance: self.provenance(state.start),
                    identity: state.start.identity,
                    seeded: false,
                    recovered: state.children.iter().any(|child| child.recovered),
                    recovery: child.recovery,
                    rule: None,
                    children: state.children.into(),
                },
            ));
            return Ok(());
        }

        state.stage += 1;
        state.stage_open = state.stage_open && child.end == state.stage_len;
        if matches!(child.value.raw(), Value::Iterable(_)) {
            let mut execution = ExpressionExecution::collect_iterable(
                mc,
                child.value,
                child.environment,
                child.origin,
            )
            .map_err(pattern_expression_error)?;
            execution.set_recovery(child.recovery);
            execution.set_external(self.external);
            state.drain = Some(Gc::new(mc, RefLock::new(execution)));
        } else {
            state.input = Some(child.value);
        }
        self.frames.push(Frame::Pipeline(state));
        Ok(())
    }

    fn schedule_over(
        &mut self,
        mc: &Mutation<'gc>,
        mut state: OverState<'gc>,
    ) -> Result<(), PatternError> {
        if state.fixed_index < state.declared.len() {
            let (name, node) = state.declared[state.fixed_index].clone();
            let value = keyed_lookup(mc, state.source, &name).unwrap_or(Value::Undefined);
            let input = Gc::new(
                mc,
                vec![state.source.carry_item(mc, value, state.fixed_index)],
            );
            let mut child_scope = state.start;
            child_scope.input = input.into();
            child_scope.source = None;
            child_scope.identity = state.start.identity.nested(
                mc,
                state.start.position,
                PathSegment::Key(name.clone()),
            );
            child_scope.position = 0;
            child_scope.environment = state.environment;
            child_scope.base = value
                .origin()
                .map_or(state.start.base, |origin| origin.start);
            state.stage = OverStage::Fixed;
            self.frames.push(Frame::Over(state));
            self.frames.push(Frame::Match(node, child_scope));
            return Ok(());
        }
        if matches!(state.stage, OverStage::Fixed) {
            state.stage = OverStage::RestKey;
        }

        if state.rest.is_empty() || state.entry_index >= state.fields.len() {
            let environment = if state.captures.is_empty() {
                state.environment
            } else {
                Environment::new(
                    mc,
                    Some(state.environment),
                    state
                        .captures
                        .into_iter()
                        .map(|(name, values)| (Rc::<str>::from(name), Value::array(mc, values)))
                        .collect(),
                )
            };
            let origin = span(state.start, state.start.position + 1);
            self.result = Some(Gc::new(
                mc,
                PatternMatch {
                    kind: MatchKind::Ok,
                    value: state.source,
                    start: state.start.position,
                    end: state.start.position + 1,
                    environment,
                    origin,
                    pattern_index: state.start.pattern_index,
                    pattern_kind: self.program.nodes[state.start.pattern_index].kind(),
                    provenance: self.provenance(state.start),
                    identity: state.start.identity,
                    seeded: false,
                    recovered: state.children.iter().any(|child| child.recovered),
                    recovery: state.start.recovery,
                    rule: None,
                    children: state.children.into(),
                },
            ));
            return Ok(());
        }

        if state.clause_index >= state.rest.len() {
            self.set(
                mc,
                state.start,
                false,
                false,
                Value::Undefined,
                state.children,
            );
            return Ok(());
        }
        loop {
            match &state.rest[state.clause_index] {
                OverRestNode::Any => {
                    state.entry_index += 1;
                    state.clause_index = 0;
                    state.stage = OverStage::RestKey;
                    if state.entry_index >= state.fields.len() {
                        return self.schedule_over(mc, state);
                    }
                }
                OverRestNode::Pattern { key, value, .. } => {
                    let field = state.fields[state.entry_index];
                    let (node, child_value) = match state.stage {
                        OverStage::RestKey => (*key, field.0),
                        OverStage::RestValue => (*value, field.1),
                        OverStage::Fixed => return Err(PatternError::InvalidState),
                    };
                    let mut child_scope = state.start;
                    child_scope.input = Gc::new(mc, vec![child_value]).into();
                    child_scope.source = None;
                    let is_key = matches!(state.stage, OverStage::RestKey);
                    let segment = match (field.0.raw(), is_key) {
                        (Value::String(key), true) => PathSegment::RestKey((*key).clone()),
                        (Value::String(key), false) => PathSegment::RestValue((*key).clone()),
                        (_, true) => PathSegment::RestEntryKey(state.entry_index),
                        (_, false) => PathSegment::RestEntryValue(state.entry_index),
                    };
                    child_scope.identity =
                        state
                            .start
                            .identity
                            .nested(mc, state.start.position, segment);
                    child_scope.position = 0;
                    child_scope.environment = if matches!(state.stage, OverStage::RestKey) {
                        state.start.environment
                    } else {
                        state.environment
                    };
                    child_scope.base = child_value
                        .origin()
                        .map_or(state.start.base, |origin| origin.start);
                    self.frames.push(Frame::Over(state));
                    self.frames.push(Frame::Match(node, child_scope));
                    return Ok(());
                }
            }
        }
    }

    fn variable_names(&self, root: usize) -> Vec<String> {
        let mut names = Vec::new();
        let mut pending = vec![root];
        while let Some(index) = pending.pop() {
            match &self.program.nodes[index] {
                PatternNode::Variable(name, child) => {
                    names.push(name.to_string());
                    pending.push(*child);
                }
                PatternNode::And(children)
                | PatternNode::Then(children)
                | PatternNode::Or(children) => pending.extend(children.iter().copied()),
                PatternNode::Unary(_, child) | PatternNode::Quantifier(child, _, _) => {
                    pending.push(*child)
                }
                PatternNode::Over(keys, rest) => {
                    pending.extend(keys.iter().map(|(_, child)| *child));
                    for clause in rest {
                        if let OverRestNode::Pattern { key, value, .. } = clause {
                            pending.push(*key);
                            pending.push(*value);
                        }
                    }
                }
                PatternNode::Switch(cases, default) => {
                    pending.extend(cases.iter().map(|(_, child)| *child));
                    pending.extend(default.iter().copied());
                }
                PatternNode::Projection(child, _) => pending.push(*child),
                PatternNode::Pipeline(children) => pending.extend(children.iter().copied()),
                _ => {}
            }
        }
        names.sort();
        names.dedup();
        names
    }

    fn finish_choice(
        &mut self,
        mc: &Mutation<'gc>,
        start: Scope<'gc>,
        chosen: Gc<'gc, PatternMatch<'gc>>,
        children: Vec<Gc<'gc, PatternMatch<'gc>>>,
    ) {
        self.result = Some(Gc::new(
            mc,
            PatternMatch {
                kind: chosen.kind,
                value: chosen.value,
                start: start.position,
                end: chosen.end,
                environment: chosen.environment,
                origin: span(start, chosen.end),
                pattern_index: start.pattern_index,
                pattern_kind: self.program.nodes[start.pattern_index].kind(),
                provenance: self.provenance(start),
                identity: start.identity,
                seeded: false,
                recovered: children
                    .iter()
                    .any(|child| child.kind != MatchKind::Fail && child.recovered),
                recovery: chosen.recovery,
                rule: None,
                children: children.into(),
            },
        ));
    }

    /// A recovered alternative passed over for a clean one, or a later recovered
    /// alternative, is kept as a failure of that alternative whose only child is
    /// its success.
    fn rejected_alternative(
        &self,
        mc: &Mutation<'gc>,
        start: Scope<'gc>,
        node: usize,
        success: Gc<'gc, PatternMatch<'gc>>,
    ) -> Gc<'gc, PatternMatch<'gc>> {
        let mut scope = start;
        scope.pattern_index = node;
        Gc::new(
            mc,
            PatternMatch {
                kind: MatchKind::Fail,
                value: Value::Undefined,
                start: start.position,
                end: start.position,
                environment: start.environment,
                origin: span(start, start.position),
                pattern_index: node,
                pattern_kind: self.program.nodes[node].kind(),
                provenance: self.provenance(scope),
                identity: start.identity,
                seeded: false,
                recovered: false,
                recovery: start.recovery,
                rule: None,
                children: MatchChildren::one(success),
            },
        )
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
                pattern_index: scope.pattern_index,
                pattern_kind: self.program.nodes[scope.pattern_index].kind(),
                provenance: self.provenance(scope),
                identity: scope.identity,
                // req:error-recovery-006 — only a *failing* seed dependence
                // masks recovery. A successful left-recursive seed that is a
                // child of a later sibling failure must not poison recover.
                seeded: if matched {
                    children.iter().any(|child| child.seeded)
                } else {
                    children
                        .iter()
                        .any(|child| child.kind == MatchKind::Fail && child.seeded)
                },
                recovered: children.iter().any(|child| child.recovered),
                recovery: children
                    .last()
                    .map_or(scope.recovery, |child| child.recovery),
                rule: None,
                children: children.into(),
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
                    pattern_index: start.pattern_index,
                    pattern_kind: self.program.nodes[start.pattern_index].kind(),
                    provenance: self.provenance(start),
                    identity: start.identity,
                    seeded: false,
                    recovered: children.iter().any(|child| child.recovered),
                    recovery: current.recovery,
                    rule: None,
                    children: children.into(),
                },
            ));
        }
    }
}

fn step_expression<'gc>(
    mc: &Mutation<'gc>,
    execution: &mut ExpressionExecution<'gc>,
) -> Result<bool, PatternError> {
    let done = execution.step(mc).map_err(pattern_expression_error)?;
    Ok(done)
}

fn pattern_expression_error(error: EvaluationError) -> PatternError {
    PatternError::Expression(Box::new(error))
}

fn span(mut scope: Scope<'_>, end: usize) -> Origin {
    if let Some(source) = scope.source {
        scope.input = source.prefix();
    }
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
            end: scope
                .input
                .get(end - 1)
                .and_then(|value| value.origin())
                .map_or(point, |origin| origin.end),
        }
    }
}

fn is_iterable_candidate(value: Value<'_>) -> bool {
    match value.raw() {
        Value::Iterable(_)
        | Value::Array(_)
        | Value::String(_)
        | Value::Set(_)
        | Value::Map(_)
        | Value::Bytes(_) => true,
        Value::Object(properties) => ["asyncIterator", "iterator"].iter().any(|key| {
            properties.borrow().get_symbol(key).is_some_and(|factory| {
                matches!(
                    factory.raw(),
                    Value::Lambda(_)
                        | Value::Native(_)
                        | Value::Host(_)
                        | Value::IteratorFactory(_)
                )
            })
        }),
        _ => false,
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
                match value {
                    LiteralValue::Missing => None,
                    LiteralValue::Present(value) => Some(value),
                },
            ) {
                (Some(Value::Undefined), None) => true,
                (Some(Value::Null), Some(JsonValue::Null)) => true,
                (Some(Value::Boolean(actual)), Some(JsonValue::Bool(expected))) => {
                    actual == *expected
                }
                (Some(Value::Number(actual)), Some(JsonValue::Number(expected))) => {
                    Some(actual) == expected.as_f64()
                }
                (Some(Value::String(actual)), Some(JsonValue::String(expected))) => {
                    *actual == *expected
                }
                // Literal aggregates have independent identity and never compare
                // equal to an input aggregate under strict equality.
                _ => false,
            },
        ),
    }
}

enum OrderedValue<'gc> {
    Number(f64),
    String(RuntimeString),
    /// An object that may expose a callable `compareTo` property.
    Object(Value<'gc>),
    Unordered,
}

fn ordered_source<'gc>(
    source: &ValueSource,
    scope: Scope<'gc>,
) -> Result<OrderedValue<'gc>, PatternError> {
    match source {
        ValueSource::Variable { name } => {
            let value = scope
                .environment
                .get(name)
                .ok_or_else(|| PatternError::UnknownValueReference(name.clone()))?;
            Ok(match value.raw() {
                Value::Number(value) => OrderedValue::Number(value),
                Value::String(value) => OrderedValue::String((*value).clone()),
                Value::Object(_) => OrderedValue::Object(value.raw()),
                _ => OrderedValue::Unordered,
            })
        }
        ValueSource::Literal { value } => Ok(match value {
            LiteralValue::Missing => OrderedValue::Unordered,
            LiteralValue::Present(JsonValue::Number(value)) => {
                OrderedValue::Number(value.as_f64().expect("JSON numbers fit f64"))
            }
            LiteralValue::Present(JsonValue::String(value)) => OrderedValue::String(value.clone()),
            _ => OrderedValue::Unordered,
        }),
    }
}

fn in_interval<'gc>(
    mc: &Mutation<'gc>,
    left: Option<&OrderedValue<'gc>>,
    right: Option<&OrderedValue<'gc>>,
    value: Value<'gc>,
) -> Result<bool, PatternError> {
    if matches!(value.raw(), Value::Null | Value::Undefined) {
        return Err(PatternError::NullValue);
    }
    let comparable = |bound: &OrderedValue<'gc>| match (bound, value.raw()) {
        (OrderedValue::Number(_), Value::Number(_))
        | (OrderedValue::String(_), Value::String(_)) => true,
        (OrderedValue::Object(bound), Value::Object(_)) => compare_to_method(*bound).is_some(),
        _ => false,
    };
    if left.is_some_and(|bound| !comparable(bound)) || right.is_some_and(|bound| !comparable(bound))
    {
        return Ok(false);
    }
    let above = match left {
        None => true,
        Some(bound) => within_bound(mc, bound, value, true)?,
    };
    let below = match right {
        None => true,
        Some(bound) => within_bound(mc, bound, value, false)?,
    };
    Ok(above && below)
}

fn compare_to_method<'gc>(bound: Value<'gc>) -> Option<Value<'gc>> {
    let Value::Object(properties) = bound.raw() else {
        return None;
    };
    properties.borrow().get("compareTo").filter(|method| {
        matches!(
            method.raw(),
            Value::Lambda(_) | Value::Native(_) | Value::Host(_)
        )
    })
}

fn call_compare_to<'gc>(
    mc: &Mutation<'gc>,
    bound: Value<'gc>,
    value: Value<'gc>,
) -> Result<f64, PatternError> {
    let method = compare_to_method(bound).ok_or(PatternError::InvalidState)?;
    let mut execution = ExpressionExecution::call_with_subject(
        mc,
        method,
        vec![value.raw()],
        Environment::new(mc, None, vec![]),
        Origin { start: 0, end: 0 },
        bound,
    );
    for _ in 0..10_000 {
        if execution.host_pending()
            || execution.input_pending()
            || execution.take_request().is_some()
        {
            return Err(PatternError::InvalidState);
        }
        if execution
            .step(mc)
            .map_err(|error| PatternError::Expression(Box::new(error)))?
        {
            return match execution.result().map(|value| value.raw()) {
                Some(Value::Number(order)) => Ok(order),
                _ => Err(PatternError::InvalidState),
            };
        }
    }
    Err(PatternError::InvalidState)
}

fn within_bound<'gc>(
    mc: &Mutation<'gc>,
    bound: &OrderedValue<'gc>,
    value: Value<'gc>,
    lower: bool,
) -> Result<bool, PatternError> {
    match (bound, value.raw()) {
        (OrderedValue::Number(bound), Value::Number(value)) => Ok(if lower {
            *bound <= value
        } else {
            value <= *bound
        }),
        (OrderedValue::String(bound), Value::String(value)) => {
            let ordering = bound.as_utf16().cmp(value.as_utf16());
            Ok(if lower {
                ordering != std::cmp::Ordering::Greater
            } else {
                ordering != std::cmp::Ordering::Less
            })
        }
        (OrderedValue::Object(bound), Value::Object(_)) => {
            let order = call_compare_to(mc, *bound, value)?;
            Ok(if lower { order >= 0.0 } else { order <= 0.0 })
        }
        _ => Ok(false),
    }
}

fn keyed_entries<'gc>(
    mc: &Mutation<'gc>,
    source: Value<'gc>,
) -> Result<Vec<(Value<'gc>, Value<'gc>)>, PatternError> {
    match source.raw() {
        Value::Object(properties) => Ok(properties
            .borrow()
            .entries()
            .iter()
            .enumerate()
            .map(|(index, (key, value))| {
                (
                    source.carry_item(mc, Value::string(mc, key), index * 2),
                    source.carry_item(mc, *value, index * 2 + 1),
                )
            })
            .collect()),
        Value::Map(entries) => entries
            .borrow()
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                let Value::Array(pair) = entry.raw() else {
                    return Err(PatternError::InvalidState);
                };
                let pair = pair.borrow();
                if pair.len() != 2 {
                    return Err(PatternError::InvalidState);
                }
                Ok((
                    source.carry_item(mc, pair[0], index * 2),
                    source.carry_item(mc, pair[1], index * 2 + 1),
                ))
            })
            .collect(),
        value => Err(PatternError::TypeError(format!(
            "expected value to be an object or Map but got {:?}",
            value.runtime_type()
        ))),
    }
}

fn keyed_lookup<'gc>(
    mc: &Mutation<'gc>,
    source: Value<'gc>,
    key: &RuntimeString,
) -> Option<Value<'gc>> {
    match source.raw() {
        Value::Object(properties) => properties.borrow().get(key),
        Value::Map(entries) => {
            let key = Value::string(mc, key);
            entries.borrow().iter().find_map(|entry| {
                let Value::Array(pair) = entry.raw() else {
                    return None;
                };
                let pair = pair.borrow();
                (pair.len() == 2 && pair[0].strict_eq(key)).then_some(pair[1])
            })
        }
        _ => None,
    }
}

fn push_capture<'gc>(
    captures: &mut Vec<(String, Vec<Value<'gc>>)>,
    name: String,
    value: Value<'gc>,
) {
    if let Some((_, values)) = captures.iter_mut().find(|(key, _)| *key == name) {
        values.push(value);
    } else {
        captures.push((name, vec![value]));
    }
}

fn compile_regexp_spec(spec: &RegExpSpec) -> Result<Arc<regress::Regex>, PatternError> {
    let (source, flags) = match spec {
        RegExpSpec::Source(source) => (source, ""),
        RegExpSpec::Detailed { source, flags } => (source, flags.as_str()),
    };
    regress::Regex::from_unicode(
        source.code_points().map(|point| {
            if point.len() == 2 {
                0x10000 + ((u32::from(point[0]) - 0xd800) << 10) + u32::from(point[1]) - 0xdc00
            } else {
                u32::from(point[0])
            }
        }),
        flags,
    )
    .map(Arc::new)
    .map_err(|error| PatternError::InvalidArgument(format!("invalid regular expression: {error}")))
}

fn character_class_matches(expression: &regress::Regex, text: &RuntimeString) -> bool {
    expression
        .find_from_utf16(text.as_utf16(), 0)
        .any(|matched| matched.range() == (0..text.len()))
}

/// Compile (or reuse) a character-class regex.
///
/// Deno compiles these once when building a `CompiledPattern`. Without a cache,
/// the Rust path recompiled on every match.
fn character_class_regex(character_class: &str) -> Result<Arc<regress::Regex>, PatternError> {
    static CACHE: OnceLock<Mutex<HashMap<String, Arc<regress::Regex>>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(existing) = cache
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .get(character_class)
    {
        return Ok(Arc::clone(existing));
    }
    let expression = match character_class {
        "A" => r"[\s\S]".to_string(),
        "Ac" => r"[\x00-\x7F]".to_string(),
        "As" => r"\p{Assigned}".to_string(),
        "L" | "Lu" | "Ll" | "Lt" | "Lm" | "Lo" | "M" | "Mn" | "Mc" | "Me" | "N" | "Nd" | "Nl"
        | "No" | "S" | "Sm" | "Sc" | "Sk" | "So" | "P" | "Pc" | "Pd" | "Ps" | "Pe" | "Pi"
        | "Pf" | "Po" | "Z" | "Zs" | "Zl" | "Zp" | "C" | "Cc" | "Cf" | "Cs" | "Co" | "Cn" => {
            format!(r"\p{{{character_class}}}")
        }
        _ => {
            return Err(PatternError::InvalidArgument(format!(
                "unknown character class {character_class}"
            )));
        }
    };
    let compiled = regress::Regex::with_flags(&expression, "u").map_err(|error| {
        PatternError::InvalidArgument(format!(
            "invalid character class {character_class}: {error}"
        ))
    })?;
    let compiled = Arc::new(compiled);
    cache
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .insert(character_class.to_string(), Arc::clone(&compiled));
    Ok(compiled)
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
        ValueSource::Literal { value } => match value {
            LiteralValue::Present(value) => value.as_f64(),
            LiteralValue::Missing => None,
        },
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
mod composite_ports;
#[cfg(test)]
mod structure_ports;
#[cfg(test)]
mod terminal_ports;
#[cfg(test)]
mod tests;

use crate::evaluate::{EvaluationError, HostCompletion};
use crate::value::Value;
use gc_arena::{Collect, Gc, Mutation, RefLock};
use gc_arena::{DynamicRoot, DynamicRootSet, Rootable};
use std::rc::Rc;

mod buffer;
pub use buffer::InputBuffer;

#[derive(Clone, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub struct Source {
    pub id: u64,
    pub name: String,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct InputSource<'gc>(Gc<'gc, RefLock<SourceState<'gc>>>);

#[derive(Collect)]
#[collect(no_drop)]
struct SourceState<'gc> {
    #[collect(require_static)]
    source: Source,
    prefix: InputBuffer<'gc>,
    identity: InputIdentity<'gc>,
    eof: bool,
    pending: Option<PendingDelivery>,
    #[collect(require_static)]
    error: Option<EvaluationError>,
}

#[derive(Collect)]
#[collect(require_static)]
struct PendingDelivery {
    token: Rc<()>,
    issued: bool,
}

#[derive(Clone)]
pub struct InputRequest {
    pub source: Source,
    pub position: usize,
    root: DynamicRoot<Rootable![InputSource<'_>]>,
    token: Rc<()>,
}

pub enum InputCompletion {
    Item(HostCompletion),
    Eof,
}

impl std::fmt::Debug for InputRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InputRequest")
            .field("source", &self.source)
            .field("position", &self.position)
            .finish()
    }
}

impl<'gc> InputSource<'gc> {
    pub fn new(mc: &Mutation<'gc>, source: Source) -> Self {
        let domain = Gc::new(mc, vec![]);
        Self(Gc::new(
            mc,
            RefLock::new(SourceState {
                source,
                prefix: InputBuffer::empty(),
                identity: InputIdentity::root(domain),
                eof: false,
                pending: None,
                error: None,
            }),
        ))
    }

    pub fn prefix(self) -> InputBuffer<'gc> {
        self.0.borrow().prefix
    }
    pub fn identity(self) -> InputIdentity<'gc> {
        self.0.borrow().identity
    }
    pub fn is_eof(self) -> bool {
        self.0.borrow().eof
    }
    pub fn pending(self) -> bool {
        self.0.borrow().pending.is_some()
    }

    pub(crate) fn require(
        self,
        mc: &Mutation<'gc>,
        position: usize,
    ) -> Result<bool, EvaluationError> {
        let mut state = self.0.borrow_mut(mc);
        if let Some(error) = &state.error {
            return Err(error.clone());
        }
        if position < state.prefix.len() || state.eof {
            return Ok(true);
        }
        if position != state.prefix.len() {
            return Err(EvaluationError::InvalidState);
        }
        if state.pending.is_none() {
            state.pending = Some(PendingDelivery {
                token: Rc::new(()),
                issued: false,
            });
        }
        Ok(false)
    }

    pub(crate) fn take_request(
        self,
        mc: &Mutation<'gc>,
        external: DynamicRootSet<'gc>,
    ) -> Option<InputRequest> {
        let mut state = self.0.borrow_mut(mc);
        let source = state.source.clone();
        let position = state.prefix.len();
        let pending = state.pending.as_mut()?;
        if pending.issued {
            return None;
        }
        pending.issued = true;
        Some(InputRequest {
            source,
            position,
            token: pending.token.clone(),
            root: external.stash::<Rootable![InputSource<'_>]>(mc, Gc::new(mc, self)),
        })
    }

    pub(crate) fn complete(
        self,
        mc: &Mutation<'gc>,
        external: DynamicRootSet<'gc>,
        request: &InputRequest,
        completion: Result<InputCompletion, String>,
    ) -> Result<(), EvaluationError> {
        {
            let state = self.0.borrow();
            if let Some(error) = &state.error {
                return Err(error.clone());
            }
            if !state
                .pending
                .as_ref()
                .is_some_and(|p| p.issued && Rc::ptr_eq(&p.token, &request.token))
            {
                return Err(EvaluationError::StaleInputRequest);
            }
        }
        let requested = *external
            .try_fetch(&request.root)
            .map_err(|_| EvaluationError::ForeignRoot)?;
        if !Gc::ptr_eq(self.0, requested.0) {
            return Err(EvaluationError::StaleInputRequest);
        }
        let completion = match completion {
            Err(message) => Err(EvaluationError::Input(message)),
            Ok(InputCompletion::Eof) => Ok(None),
            Ok(InputCompletion::Item(value)) => value
                .materialize_in(mc, external)
                .map(Some)
                .map_err(|error| match error {
                    EvaluationError::Host(message) => EvaluationError::Input(message),
                    other => other,
                }),
        };
        let mut state = self.0.borrow_mut(mc);
        state.pending = None;
        match completion {
            Ok(Some(value)) => {
                state.prefix = state.prefix.append(
                    mc,
                    value.wrap(
                        mc,
                        value.origin().unwrap_or(crate::provenance::Origin {
                            start: request.position,
                            end: request.position + 1,
                        }),
                    ),
                );
                Ok(())
            }
            Ok(None) => {
                state.eof = true;
                Ok(())
            }
            Err(error) => {
                state.error = Some(error.clone());
                Err(error)
            }
        }
    }

    pub fn cancel(self, mc: &Mutation<'gc>) {
        let mut state = self.0.borrow_mut(mc);
        state.pending = None;
        state.error = Some(EvaluationError::Cancelled);
    }
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct RecoveryContext<'gc> {
    enabled: bool,
    reached: Gc<'gc, RefLock<bool>>,
}

impl<'gc> RecoveryContext<'gc> {
    pub fn new(mc: &Mutation<'gc>) -> Self {
        Self {
            enabled: false,
            reached: Gc::new(mc, RefLock::new(false)),
        }
    }

    pub fn is_enabled(self) -> bool {
        self.enabled
    }

    pub fn enable(self) -> Self {
        Self {
            enabled: true,
            ..self
        }
    }

    pub fn disable(self) -> Self {
        Self {
            enabled: false,
            ..self
        }
    }

    pub fn record_failure(self, mc: &Mutation<'gc>) {
        *self.reached.borrow_mut(mc) = true;
    }

    pub fn was_reached(self) -> bool {
        *self.reached.borrow()
    }
}

/// A stream domain is kept alive by the cursor, so its allocation identity
/// cannot be recycled while a memo key derived from it is still usable.
#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct InputIdentity<'gc> {
    domain: Gc<'gc, Vec<Value<'gc>>>,
    path: Option<Gc<'gc, Path<'gc>>>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct Path<'gc> {
    parent: Option<Gc<'gc, Self>>,
    segment: PathSegment,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Collect)]
#[collect(require_static)]
pub enum PathSegment {
    Item(usize),
    Into,
    Key(crate::text::RuntimeString),
    RestKey(crate::text::RuntimeString),
    RestValue(crate::text::RuntimeString),
    Entry(usize),
    RestEntryKey(usize),
    RestEntryValue(usize),
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct InputPosition {
    pub domain: usize,
    pub path: Vec<PathSegment>,
    pub cursor: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum DiagnosticSegment {
    Index(usize),
    Key(crate::text::RuntimeString),
}

impl InputPosition {
    pub fn diagnostic_path(&self) -> Vec<DiagnosticSegment> {
        let mut path = Vec::new();
        for segment in &self.path {
            match segment {
                PathSegment::Item(index)
                | PathSegment::Entry(index)
                | PathSegment::RestEntryValue(index) => path.push(DiagnosticSegment::Index(*index)),
                PathSegment::Into => {}
                PathSegment::Key(key) | PathSegment::RestValue(key) => {
                    path.push(DiagnosticSegment::Key(key.clone()))
                }
                PathSegment::RestKey(key) => {
                    path.push(DiagnosticSegment::Key(key.clone()));
                    path.push(DiagnosticSegment::Key("$key".into()));
                }
                PathSegment::RestEntryKey(index) => {
                    path.push(DiagnosticSegment::Index(*index));
                    path.push(DiagnosticSegment::Key("$key".into()));
                }
            }
        }
        path.push(DiagnosticSegment::Index(self.cursor));
        path
    }
}

impl std::fmt::Display for InputPosition {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for (index, segment) in self.diagnostic_path().iter().enumerate() {
            if index > 0 {
                write!(formatter, ".")?;
            }
            match segment {
                DiagnosticSegment::Index(index) => write!(formatter, "[{index}]")?,
                DiagnosticSegment::Key(key) => {
                    write!(formatter, "{}", crate::json::JsonValue::String(key.clone()))?
                }
            }
        }
        Ok(())
    }
}

impl<'gc> InputIdentity<'gc> {
    pub fn root(domain: Gc<'gc, Vec<Value<'gc>>>) -> Self {
        Self { domain, path: None }
    }

    /// Into/over share the originating domain and extend its structural path.
    /// Computed input instead starts a fresh `root`, even at the same span.
    pub fn nested(self, mc: &Mutation<'gc>, item: usize, segment: PathSegment) -> Self {
        let item = Gc::new(
            mc,
            Path {
                parent: self.path,
                segment: PathSegment::Item(item),
            },
        );
        Self {
            domain: self.domain,
            path: Some(Gc::new(
                mc,
                Path {
                    parent: Some(item),
                    segment,
                },
            )),
        }
    }

    pub fn position(self, cursor: usize) -> InputPosition {
        let mut path = Vec::new();
        let mut current = self.path;
        while let Some(node) = current {
            path.push(node.segment.clone());
            current = node.parent;
        }

        path.reverse();
        InputPosition {
            domain: Gc::as_ptr(self.domain) as usize,
            path,
            cursor,
        }
    }

    pub(crate) fn rebased(self, root: Self) -> Self {
        Self {
            domain: root.domain,
            path: self.path,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::{Arena, Rootable};

    #[test]
    // req:cli-command-model-005
    fn diagnostic_paths_preserve_nested_indices_keys_and_rightmost_ordering() {
        let root = InputPosition {
            domain: 1,
            path: vec![],
            cursor: 0,
        };
        let nested = InputPosition {
            domain: 1,
            path: vec![PathSegment::Item(0), PathSegment::Into],
            cursor: 0,
        };
        let keyed = InputPosition {
            domain: 1,
            path: vec![PathSegment::Item(0), PathSegment::Key("a".into())],
            cursor: 0,
        };
        assert_eq!(root.to_string(), "[0]");
        assert_eq!(nested.to_string(), "[0].[0]");
        assert_eq!(keyed.to_string(), "[0].\"a\".[0]");
        assert!(root.diagnostic_path() < nested.diagnostic_path());
        assert!(nested.diagnostic_path() < keyed.diagnostic_path());
        let rest = InputPosition {
            domain: 1,
            path: vec![PathSegment::Item(0), PathSegment::RestKey("a".into())],
            cursor: 0,
        };
        assert_eq!(rest.to_string(), "[0].\"a\".\"$key\".[0]");
    }

    #[test]
    // req:runtime-core-014 req:runtime-memory-004
    fn delivery_is_cached_per_position_and_identity_survives_prefix_appends() {
        let mut arena = Arena::<Rootable![(InputSource<'_>, DynamicRootSet<'_>)]>::new(|mc| {
            (
                InputSource::new(
                    mc,
                    Source {
                        id: 1,
                        name: "input".into(),
                    },
                ),
                DynamicRootSet::new(mc),
            )
        });
        let identity = arena.mutate(|_, (source, _)| source.identity().position(0));
        for index in 0..33 {
            let request = arena.mutate_root(|mc, (source, external)| {
                assert!(!source.require(mc, index).unwrap());
                let request = source.take_request(mc, *external).unwrap();
                assert!(source.take_request(mc, *external).is_none());
                request
            });
            arena.finish_cycle();
            arena.mutate_root(|mc, (source, external)| {
                source
                    .complete(
                        mc,
                        *external,
                        &request,
                        Ok(InputCompletion::Item(HostCompletion::materialize(
                            vec![],
                            move |_, _| Ok(Value::Number(index as f64)),
                        ))),
                    )
                    .unwrap();
                assert!(source.require(mc, 0).unwrap());
                assert!(!source.pending());
                assert_eq!(source.identity().position(0), identity);
                assert_eq!(source.prefix().len(), index + 1);
                assert!(source.prefix()[0].raw().strict_eq(Value::Number(0.0)));
                assert!(matches!(
                    source.complete(mc, *external, &request, Ok(InputCompletion::Eof)),
                    Err(EvaluationError::StaleInputRequest)
                ));
            });
        }
    }

    #[test]
    // req:runtime-core-014 req:runtime-memory-002
    fn retained_delivery_request_keeps_cached_cycles_alive_until_dropped() {
        let mut arena = Arena::<
            Rootable![(
                Option<InputSource<'_>>,
                DynamicRootSet<'_>,
                Option<gc_arena::GcWeak<'_, RefLock<crate::value::ObjectProperties<'_>>>>
            )],
        >::new(|mc| {
            (
                Some(InputSource::new(
                    mc,
                    Source {
                        id: 1,
                        name: "source".into(),
                    },
                )),
                DynamicRootSet::new(mc),
                None,
            )
        });
        let first = arena.mutate_root(|mc, (source, external, _)| {
            let source = source.unwrap();
            source.require(mc, 0).unwrap();
            source.take_request(mc, *external).unwrap()
        });
        arena.mutate_root(|mc, (source, external, weak)| {
            let root = crate::evaluate::HostCompletion::materialize(vec![], |mc, _| {
                let value = Value::object(mc, vec![]);
                let Value::Object(object) = value else {
                    unreachable!()
                };
                object.borrow_mut(mc).set("self".into(), value);
                Ok(value)
            });
            source
                .unwrap()
                .complete(mc, *external, &first, Ok(InputCompletion::Item(root)))
                .unwrap();
            let Value::Object(object) = source.unwrap().prefix()[0].raw() else {
                unreachable!()
            };
            *weak = Some(Gc::downgrade(object));
        });
        drop(first);
        let request = arena.mutate_root(|mc, (source, external, _)| {
            source.unwrap().require(mc, 1).unwrap();
            source.unwrap().take_request(mc, *external).unwrap()
        });
        arena.mutate_root(|mc, (source, _, _)| {
            source.unwrap().cancel(mc);
            *source = None;
        });
        arena.finish_cycle();
        arena.mutate(|mc, (_, _, weak)| assert!(weak.unwrap().upgrade(mc).is_some()));
        drop(request);
        arena.finish_cycle();
        arena.mutate(|mc, (_, _, weak)| assert!(weak.unwrap().upgrade(mc).is_none()));
    }

    #[test]
    // req:error-recovery-001 req:error-recovery-005
    fn recovery_discovery_is_shared_but_settings_are_immutable() {
        gc_arena::arena::rootless_mutate(|mc| {
            let discovery = RecoveryContext::new(mc);
            let recovery = discovery.enable();
            recovery.record_failure(mc);
            assert!(discovery.was_reached());
            assert!(!discovery.is_enabled());
            assert!(recovery.is_enabled());
            assert!(!recovery.disable().is_enabled());
        });
    }

    #[test]
    // req:runtime-core-004 req:rules-001
    fn nested_positions_extend_items_and_computed_domains_remain_distinct() {
        type Root<'gc> = (
            InputIdentity<'gc>,
            InputIdentity<'gc>,
            InputIdentity<'gc>,
            InputIdentity<'gc>,
            InputIdentity<'gc>,
        );
        let mut arena = Arena::<Rootable![Root<'_>]>::new(|mc| {
            let stream = Gc::new(mc, vec![Value::Null]);
            let root = InputIdentity::root(stream);
            (
                root,
                root.nested(mc, 0, PathSegment::Into),
                root.nested(mc, 0, PathSegment::Key("a".into())),
                root.nested(mc, 0, PathSegment::Key("b".into())),
                InputIdentity::root(Gc::new(mc, vec![Value::Null])),
            )
        });
        arena.finish_cycle();
        arena.mutate(|_, (root, into, a, b, computed)| {
            assert_ne!(root.position(0), into.position(0));
            assert_ne!(into.position(0), into.position(1));
            assert_ne!(a.position(0), b.position(0));
            assert_ne!(root.position(0), computed.position(0));
            assert_eq!(root.position(0).domain, into.position(0).domain);
            assert_eq!(
                a.position(0).path,
                vec![PathSegment::Item(0), PathSegment::Key("a".into())]
            );
        });
    }

    #[test]
    // req:runtime-core-004 req:over-001 req:runtime-strings-002
    fn map_entry_paths_cannot_alias_author_supplied_string_keys() {
        gc_arena::arena::rootless_mutate(|mc| {
            let root = InputIdentity::root(Gc::new(mc, vec![Value::Null]));
            let string_key = root.nested(mc, 0, PathSegment::Key("#0".into()));
            let map_entry = root.nested(mc, 0, PathSegment::Entry(0));
            assert_ne!(string_key.position(0), map_entry.position(0));
            let key = root.nested(mc, 0, PathSegment::RestEntryKey(0));
            let value = root.nested(mc, 0, PathSegment::RestEntryValue(0));
            assert_ne!(key.position(0), value.position(0));
            let isolated = root.nested(
                mc,
                0,
                PathSegment::Key(crate::text::RuntimeString::from_utf16(vec![0xd800])),
            );
            let replacement = root.nested(mc, 0, PathSegment::Key("\u{fffd}".into()));
            assert_ne!(isolated.position(0), replacement.position(0));
        });
    }

    #[test]
    // req:incremental-parsing-004 req:runtime-core-004
    fn rebased_nested_identity_preserves_path_but_uses_the_fresh_domain() {
        gc_arena::arena::rootless_mutate(|mc| {
            let old = InputIdentity::root(Gc::new(mc, vec![Value::Null]));
            let fresh = InputIdentity::root(Gc::new(mc, vec![Value::Null]));
            let nested = old.nested(mc, 3, PathSegment::Key("x".into()));
            let rebased = nested.rebased(fresh).position(2);
            assert_eq!(rebased.domain, fresh.position(0).domain);
            assert_eq!(rebased.path, nested.position(2).path);
            assert_eq!(rebased.cursor, 2);
            assert_ne!(rebased.domain, old.position(0).domain);
        });
    }

    #[test]
    // req:runtime-core-008 req:runtime-core-009
    fn deep_paths_are_rooted_and_walked_without_host_recursion() {
        let mut arena = Arena::<Rootable![InputIdentity<'_>]>::new(|mc| {
            let mut identity = InputIdentity::root(Gc::new(mc, vec![Value::Null]));
            for _ in 0..10_000 {
                identity = identity.nested(mc, 0, PathSegment::Into);
            }
            identity
        });
        arena.finish_cycle();
        arena.mutate(|_, identity| assert_eq!(identity.position(0).path.len(), 20_000));
    }
}

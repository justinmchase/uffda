use crate::value::Value;
use gc_arena::{Collect, Gc, Mutation, RefLock};

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
    Key(String),
    RestKey(String),
    RestValue(String),
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::{Arena, Rootable};

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
    // req:runtime-core-004 req:over-001
    fn map_entry_paths_cannot_alias_author_supplied_string_keys() {
        gc_arena::arena::rootless_mutate(|mc| {
            let root = InputIdentity::root(Gc::new(mc, vec![Value::Null]));
            let string_key = root.nested(mc, 0, PathSegment::Key("#0".into()));
            let map_entry = root.nested(mc, 0, PathSegment::Entry(0));
            assert_ne!(string_key.position(0), map_entry.position(0));
            let key = root.nested(mc, 0, PathSegment::RestEntryKey(0));
            let value = root.nested(mc, 0, PathSegment::RestEntryValue(0));
            assert_ne!(key.position(0), value.position(0));
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

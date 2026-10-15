use std::collections::HashMap;

use crate::{Arena, Collect, DynamicRootSet, Gc, GcWeak, RefLock, rootless_mutate};

#[derive(Collect)]
#[collect(no_drop)]
struct Node<'gc> {
    value: u32,
    #[collect(require_static)]
    label: String,
    next: Option<Gc<'gc, RefLock<Node<'gc>>>>,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Shape<'gc> {
    Leaf(u32),
    Pair(Gc<'gc, Shape<'gc>>, Gc<'gc, Shape<'gc>>),
}

#[derive(Collect)]
#[collect(require_static)]
struct Plain {
    text: String,
}

#[derive(Collect, Default)]
#[collect(no_drop)]
struct Roots<'gc> {
    nodes: Vec<Gc<'gc, RefLock<Node<'gc>>>>,
    weak: Vec<GcWeak<'gc, RefLock<Node<'gc>>>>,
    named: HashMap<String, Gc<'gc, Shape<'gc>>>,
}

fn node<'gc>(mc: &crate::Mutation<'gc>, value: u32) -> Gc<'gc, RefLock<Node<'gc>>> {
    Gc::new(
        mc,
        RefLock::new(Node {
            value,
            label: format!("n{value}"),
            next: None,
        }),
    )
}

fn arena() -> Arena<Rootable![Roots<'_>]> {
    Arena::new(|_| Roots::default())
}

#[test]
fn derives_trace_structs_enums_and_static_types() {
    const {
        assert!(<Node<'static> as Collect>::NEEDS_TRACE);
        assert!(<Shape<'static> as Collect>::NEEDS_TRACE);
        assert!(!<Plain as Collect>::NEEDS_TRACE);
    }
    rootless_mutate(|mc| {
        let leaf = Gc::new(mc, Shape::Leaf(1));
        let pair = Gc::new(mc, Shape::Pair(leaf, leaf));
        let Shape::Pair(left, right) = &*pair else {
            panic!("expected pair");
        };
        assert!(Gc::ptr_eq(*left, *right));
        assert!(matches!(**left, Shape::Leaf(1)));
        assert_eq!(Gc::new(mc, Plain { text: "x".into() }).text, "x");
    });
}

#[test]
fn gc_identity_and_value_equality_are_distinct() {
    rootless_mutate(|mc| {
        let a = Gc::new(mc, 7u32);
        let b = Gc::new(mc, 7u32);
        assert_eq!(a, b);
        assert!(!Gc::ptr_eq(a, b));
        assert!(Gc::ptr_eq(a, a));
        assert_eq!(Gc::as_ptr(a), Gc::as_ref(a) as *const u32);
    });
}

#[test]
fn reflock_mutation_is_visible_through_every_pointer() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let first = node(mc, 1);
        roots.nodes.push(first);
        roots.nodes.push(first);
        first.borrow_mut(mc).value = 2;
    });
    arena.finish_cycle();
    arena.mutate(|_, roots| {
        assert_eq!(roots.nodes[1].borrow().value, 2);
        assert_eq!(roots.nodes[1].borrow().label, "n1");
    });
}

#[test]
fn reachable_values_survive_collection() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let head = node(mc, 1);
        head.borrow_mut(mc).next = Some(node(mc, 2));
        roots.nodes.push(head);
        let leaf = Gc::new(mc, Shape::Leaf(3));
        roots
            .named
            .insert("pair".into(), Gc::new(mc, Shape::Pair(leaf, leaf)));
    });
    for _ in 0..3 {
        arena.finish_cycle();
    }
    arena.mutate(|_, roots| {
        let next = roots.nodes[0].borrow().next.unwrap();
        assert_eq!(next.borrow().value, 2);
        let Shape::Pair(left, _) = &*roots.named["pair"] else {
            panic!("expected pair");
        };
        assert!(matches!(**left, Shape::Leaf(3)));
    });
}

#[test]
#[allow(clippy::drop_non_drop)]
fn dynamic_roots_round_trip() {
    // The closure is required: `DynamicRootSet::new` is not higher-ranked over `'gc`.
    #[allow(clippy::redundant_closure)]
    let mut arena = Arena::<Rootable![DynamicRootSet<'_>]>::new(|mc| DynamicRootSet::new(mc));
    let handle = arena.mutate(|mc, set| set.stash::<Rootable![RefLock<Node<'_>>]>(mc, node(mc, 9)));
    arena.finish_cycle();
    arena.mutate(|_, set| {
        assert!(set.contains(&handle));
        assert_eq!(set.fetch(&handle).borrow().value, 9);
    });
    let copy = handle.clone();
    drop(handle);
    arena.finish_cycle();
    arena.mutate(|_, set| assert_eq!(set.fetch(&copy).borrow().value, 9));
}

#[test]
fn fetching_from_another_root_set_fails() {
    rootless_mutate(|mc| {
        let first = DynamicRootSet::new(mc);
        let second = DynamicRootSet::new(mc);
        let handle = first.stash::<Rootable![u32]>(mc, Gc::new(mc, 4));
        assert!(!second.contains(&handle));
        assert_eq!(
            second.try_fetch(&handle).err(),
            Some(crate::MismatchedRootSet)
        );
        assert_eq!(*first.try_fetch(&handle).unwrap(), 4);
    });
}

#[test]
fn try_new_propagates_errors() {
    let result = Arena::<Rootable![Roots<'_>]>::try_new(|_| Err::<Roots<'_>, _>("nope"));
    assert_eq!(result.err(), Some("nope"));
    let arena = Arena::<Rootable![Roots<'_>]>::try_new(|_| Ok::<_, ()>(Roots::default())).unwrap();
    arena.mutate(|_, roots| assert!(roots.nodes.is_empty()));
}

#[cfg(not(feature = "leak"))]
mod collector {
    use super::*;

    #[test]
    fn unreachable_values_are_freed() {
        let mut arena = arena();
        arena.mutate_root(|mc, roots| {
            let kept = node(mc, 1);
            let dropped = node(mc, 2);
            roots.weak.push(Gc::downgrade(kept));
            roots.weak.push(Gc::downgrade(dropped));
            roots.nodes.push(kept);
        });
        arena.finish_cycle();
        arena.mutate(|mc, roots| {
            assert!(roots.weak[0].upgrade(mc).is_some());
            assert!(roots.weak[1].upgrade(mc).is_none());
        });
        let live = arena.metrics().total_gc_count();
        arena.mutate_root(|_, roots| {
            roots.nodes.clear();
            roots.weak.clear();
        });
        arena.finish_cycle();
        assert!(arena.metrics().total_gc_count() < live);
    }

    #[test]
    fn write_barrier_keeps_child_added_after_marking_alive() {
        let mut arena = arena();
        arena.mutate_root(|mc, roots| roots.nodes.push(node(mc, 1)));
        arena.finish_cycle();
        arena.finish_marking().unwrap().start_sweeping();
        arena.mutate_root(|mc, roots| {
            let child = node(mc, 2);
            roots.nodes[0].borrow_mut(mc).next = Some(child);
            roots.weak.push(Gc::downgrade(child));
        });
        arena.finish_cycle();
        arena.finish_cycle();
        arena.mutate(|mc, roots| {
            let child = roots.weak[0].upgrade(mc).expect("child was freed");
            assert_eq!(child.borrow().value, 2);
        });
    }

    #[test]
    fn released_dynamic_root_is_freed() {
        let mut arena =
            Arena::<Rootable![(DynamicRootSet<'_>, Vec<GcWeak<'_, RefLock<Node<'_>>>>)]>::new(
                |mc| (DynamicRootSet::new(mc), vec![]),
            );
        let handle = arena.mutate_root(|mc, (set, weak)| {
            let value = node(mc, 5);
            weak.push(Gc::downgrade(value));
            set.stash::<Rootable![RefLock<Node<'_>>]>(mc, value)
        });
        arena.finish_cycle();
        arena.mutate(|mc, (_, weak)| assert!(weak[0].upgrade(mc).is_some()));
        drop(handle);
        arena.finish_cycle();
        arena.mutate(|mc, (_, weak)| assert!(weak[0].upgrade(mc).is_none()));
    }
}

#[cfg(feature = "leak")]
#[test]
fn leak_backend_never_frees() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let value = node(mc, 1);
        roots.weak.push(Gc::downgrade(value));
    });
    arena.finish_cycle();
    arena.mutate(|mc, roots| assert!(roots.weak[0].upgrade(mc).is_some()));
    assert_eq!(crate::BACKEND, "leak");
}

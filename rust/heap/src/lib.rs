//! Garbage-collected heap used by the Uffda runtime.
//!
//! Runtime code names only this crate. The collector behind it is chosen by
//! Cargo feature:
//!
//! - `gc-arena` (default): incremental tracing collector from the `gc-arena`
//!   crate.
//! - `leak`: diagnostic backend that never frees. Every allocation lives until
//!   process exit and collection does nothing. It exists to isolate collector
//!   behavior from the rest of the runtime and must not ship.
//!
//! Every allocation is made inside an [`Arena`] callback that receives a
//! [`Mutation`] context. Pointers are branded with the callback's `'gc`
//! lifetime, so they cannot escape the arena or outlive a collection.

extern crate alloc;
extern crate self as uffda_heap;

mod collect;
mod lock;

#[cfg(feature = "leak")]
#[path = "leak.rs"]
mod backend;

#[cfg(all(feature = "gc-arena", not(feature = "leak")))]
#[path = "gc_arena.rs"]
mod backend;

#[cfg(not(any(feature = "gc-arena", feature = "leak")))]
compile_error!("uffda-heap requires a backend feature: `gc-arena` or `leak`");

pub use backend::{
    Arena, DynamicRoot, DynamicRootSet, Gc, GcWeak, MarkedArena, Metrics, Mutation, rootless_mutate,
};
pub use collect::{__MustNotImplDrop, Collect, Trace};
pub use lock::RefLock;
pub use uffda_heap_derive::{__unelide_lifetimes, Collect};

/// The name of the active backend, for diagnostics.
pub const BACKEND: &str = backend::NAME;

/// A [`DynamicRoot`] was fetched from a [`DynamicRootSet`] that did not stash
/// it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MismatchedRootSet;

impl core::fmt::Display for MismatchedRootSet {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("dynamic root fetched from a different root set")
    }
}

impl std::error::Error for MismatchedRootSet {}

/// A type constructor for an arena root, parameterized by the `'gc` lifetime.
pub trait Rootable<'a> {
    type Root: ?Sized + 'a;
}

/// The root type of `R` for a specific `'gc` lifetime.
pub type Root<'a, R> = <R as Rootable<'a>>::Root;

/// Marker produced by [`Rootable!`] so callers need not write `?Sized` bounds.
#[doc(hidden)]
pub struct __DynRootable<T: ?Sized>(core::marker::PhantomData<T>);

impl<'a, T: ?Sized + Rootable<'a>> Rootable<'a> for __DynRootable<T> {
    type Root = <T as Rootable<'a>>::Root;
}

/// Names a [`Rootable`] type. `Rootable![Foo<'_>]` replaces each `'_` with
/// the branding lifetime; `Rootable!['gc => Foo<'gc>]` names it explicitly.
#[macro_export]
macro_rules! Rootable {
    ($gc:lifetime => $root:ty) => {
        $crate::__DynRootable::<dyn for<$gc> $crate::Rootable<$gc, Root = $root>>
    };
    ($root:ty) => {
        $crate::Rootable!['__gc => $crate::__unelide_lifetimes!('__gc; $root)]
    };
}

#[cfg(test)]
mod tests;

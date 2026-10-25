use alloc::{
    boxed::Box,
    collections::{BTreeMap, BTreeSet, BinaryHeap, LinkedList, VecDeque},
    rc::Rc,
    string::String,
    sync::Arc,
    vec::Vec,
};
use core::{
    cell::{Cell, RefCell},
    marker::PhantomData,
};
use std::collections::{HashMap, HashSet};

use crate::backend::{ErasedGc, ErasedGcWeak};

/// A type that can be stored in the garbage-collected heap.
///
/// # Safety
///
/// `trace` must visit every `Gc`/`GcWeak` reachable from `self`, and
/// `NEEDS_TRACE` may only be `false` when no such pointer can exist. Prefer
/// `#[derive(Collect)]`, which upholds this.
pub unsafe trait Collect<'gc> {
    const NEEDS_TRACE: bool = true;

    #[inline]
    #[allow(unused_variables)]
    fn trace<T: Trace<'gc>>(&self, cc: &mut T) {}
}

/// Visitor handed to [`Collect::trace`].
pub trait Trace<'gc> {
    #[doc(hidden)]
    fn trace_gc(&mut self, gc: ErasedGc<'gc>);

    #[doc(hidden)]
    fn trace_gc_weak(&mut self, gc: ErasedGcWeak<'gc>);

    #[inline]
    fn trace<C: Collect<'gc> + ?Sized>(&mut self, value: &C)
    where
        Self: Sized,
    {
        if C::NEEDS_TRACE {
            value.trace(self);
        }
    }
}

/// Implemented by `#[derive(Collect)]` with `#[collect(no_drop)]`; conflicts
/// with the blanket impl below if the type also implements `Drop`.
#[doc(hidden)]
pub trait __MustNotImplDrop {}

#[allow(drop_bounds)]
impl<T: Drop> __MustNotImplDrop for T {}

macro_rules! static_collect {
    ($($type:ty),* $(,)?) => {
        $(
            unsafe impl<'gc> Collect<'gc> for $type {
                const NEEDS_TRACE: bool = false;
            }
        )*
    };
}

static_collect!(
    bool,
    char,
    u8,
    u16,
    u32,
    u64,
    u128,
    usize,
    i8,
    i16,
    i32,
    i64,
    i128,
    isize,
    f32,
    f64,
    String,
    str,
    std::path::Path,
    std::path::PathBuf,
    std::ffi::OsStr,
    std::ffi::OsString,
);

unsafe impl<'gc, T: ?Sized + 'static> Collect<'gc> for &'static T {
    const NEEDS_TRACE: bool = false;
}

unsafe impl<'gc, T: ?Sized + Collect<'gc>> Collect<'gc> for Box<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        cc.trace(&**self)
    }
}

unsafe impl<'gc, T: Collect<'gc>> Collect<'gc> for [T] {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        for t in self {
            cc.trace(t)
        }
    }
}

unsafe impl<'gc, T: Collect<'gc>, const N: usize> Collect<'gc> for [T; N] {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        for t in self {
            cc.trace(t)
        }
    }
}

unsafe impl<'gc, T: Collect<'gc>> Collect<'gc> for Option<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        if let Some(t) = self {
            cc.trace(t)
        }
    }
}

unsafe impl<'gc, T: Collect<'gc>, E: Collect<'gc>> Collect<'gc> for Result<T, E> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE || E::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        match self {
            Ok(r) => cc.trace(r),
            Err(e) => cc.trace(e),
        }
    }
}

macro_rules! sequence_collect {
    ($($container:ident),* $(,)?) => {
        $(
            unsafe impl<'gc, T: Collect<'gc>> Collect<'gc> for $container<T> {
                const NEEDS_TRACE: bool = T::NEEDS_TRACE;

                #[inline]
                fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
                    for t in self {
                        cc.trace(t)
                    }
                }
            }
        )*
    };
}

sequence_collect!(Vec, VecDeque, LinkedList, BTreeSet, BinaryHeap);

unsafe impl<'gc, T: Collect<'gc>, S: 'static> Collect<'gc> for HashSet<T, S> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        for t in self {
            cc.trace(t)
        }
    }
}

unsafe impl<'gc, K: Collect<'gc>, V: Collect<'gc>, S: 'static> Collect<'gc> for HashMap<K, V, S> {
    const NEEDS_TRACE: bool = K::NEEDS_TRACE || V::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        for (k, v) in self {
            cc.trace(k);
            cc.trace(v);
        }
    }
}

unsafe impl<'gc, K: Collect<'gc>, V: Collect<'gc>> Collect<'gc> for BTreeMap<K, V> {
    const NEEDS_TRACE: bool = K::NEEDS_TRACE || V::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        for (k, v) in self {
            cc.trace(k);
            cc.trace(v);
        }
    }
}

unsafe impl<'gc, T: ?Sized + Collect<'gc>> Collect<'gc> for Rc<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        cc.trace(&**self);
    }
}

unsafe impl<'gc, T: ?Sized + Collect<'gc>> Collect<'gc> for Arc<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        cc.trace(&**self);
    }
}

unsafe impl<'gc, T: 'static> Collect<'gc> for Cell<T> {
    const NEEDS_TRACE: bool = false;
}

unsafe impl<'gc, T: 'static> Collect<'gc> for RefCell<T> {
    const NEEDS_TRACE: bool = false;
}

unsafe impl<'gc, T> Collect<'gc> for PhantomData<T> {
    const NEEDS_TRACE: bool = false;
}

macro_rules! impl_tuple {
    () => {
        unsafe impl<'gc> Collect<'gc> for () {
            const NEEDS_TRACE: bool = false;
        }
    };
    ($($name:ident)+) => {
        unsafe impl<'gc, $($name,)*> Collect<'gc> for ($($name,)*)
        where
            $($name: Collect<'gc>,)*
        {
            const NEEDS_TRACE: bool = false $(|| $name::NEEDS_TRACE)*;

            #[allow(non_snake_case)]
            #[inline]
            fn trace<TR: Trace<'gc>>(&self, cc: &mut TR) {
                let ($($name,)*) = self;
                $(cc.trace($name);)*
            }
        }
    };
}

impl_tuple! {}
impl_tuple! {A}
impl_tuple! {A B}
impl_tuple! {A B C}
impl_tuple! {A B C D}
impl_tuple! {A B C D E}
impl_tuple! {A B C D E F}
impl_tuple! {A B C D E F G}
impl_tuple! {A B C D E F G H}

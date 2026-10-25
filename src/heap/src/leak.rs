//! Diagnostic backend that never frees.
//!
//! Every `Gc::new` leaks a `Box`, so every pointer stays valid until the
//! process exits and collection is a no-op. The only `Mutation` that exists is
//! `Mutation<'static>`, so every `'gc` lifetime in this backend is `'static`.

use core::{
    borrow::Borrow,
    cmp::Ordering,
    fmt,
    hash::{Hash, Hasher},
    marker::PhantomData,
    ops::Deref,
    sync::atomic::{AtomicUsize, Ordering as AtomicOrdering},
};

use alloc::boxed::Box;

use crate::{Collect, MismatchedRootSet, Root, Rootable};

pub(crate) const NAME: &str = "leak";

static ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);

type Invariant<'gc> = PhantomData<fn(&'gc ()) -> &'gc ()>;

#[doc(hidden)]
pub struct ErasedGc<'gc>(Invariant<'gc>);

#[doc(hidden)]
pub struct ErasedGcWeak<'gc>(Invariant<'gc>);

/// Allocation context. Only `Mutation<'static>` is ever constructed.
pub struct Mutation<'gc>(Invariant<'gc>);

static MUTATION: Mutation<'static> = Mutation(PhantomData);

impl<'gc> Mutation<'gc> {
    #[inline]
    pub(crate) fn write_barrier<T: ?Sized + 'gc>(&self, _gc: Gc<'gc, T>) {}
}

/// A pointer to a leaked value.
pub struct Gc<'gc, T: ?Sized + 'gc> {
    ptr: &'gc T,
    _invariant: Invariant<'gc>,
}

impl<'gc, T: ?Sized + 'gc> Copy for Gc<'gc, T> {}

impl<'gc, T: ?Sized + 'gc> Clone for Gc<'gc, T> {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

impl<'gc, T: Collect<'gc> + 'gc> Gc<'gc, T> {
    #[inline]
    pub fn new(_mc: &Mutation<'gc>, t: T) -> Self {
        ALLOCATIONS.fetch_add(1, AtomicOrdering::Relaxed);
        Self {
            ptr: Box::leak(Box::new(t)),
            _invariant: PhantomData,
        }
    }
}

impl<'gc, T: ?Sized + 'gc> Gc<'gc, T> {
    /// Borrows the value for the whole `'gc` lifetime, which `AsRef` cannot express.
    #[inline]
    #[allow(clippy::should_implement_trait)]
    pub fn as_ref(this: Self) -> &'gc T {
        this.ptr
    }

    #[inline]
    pub fn downgrade(this: Self) -> GcWeak<'gc, T> {
        GcWeak { gc: this }
    }

    #[inline]
    pub fn ptr_eq(this: Self, other: Self) -> bool {
        core::ptr::eq(this.ptr, other.ptr)
    }

    #[inline]
    pub fn as_ptr(this: Self) -> *const T {
        this.ptr as *const T
    }
}

unsafe impl<'gc, T: ?Sized + 'gc> Collect<'gc> for Gc<'gc, T> {}

impl<'gc, T: ?Sized + 'gc> Deref for Gc<'gc, T> {
    type Target = T;

    #[inline]
    fn deref(&self) -> &T {
        self.ptr
    }
}

impl<'gc, T: ?Sized + 'gc> AsRef<T> for Gc<'gc, T> {
    #[inline]
    fn as_ref(&self) -> &T {
        self.ptr
    }
}

impl<'gc, T: ?Sized + 'gc> Borrow<T> for Gc<'gc, T> {
    #[inline]
    fn borrow(&self) -> &T {
        self.ptr
    }
}

impl<'gc, T: fmt::Debug + ?Sized + 'gc> fmt::Debug for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(self.ptr, f)
    }
}

impl<'gc, T: fmt::Display + ?Sized + 'gc> fmt::Display for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self.ptr, f)
    }
}

impl<'gc, T: ?Sized + 'gc> fmt::Pointer for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&self.ptr, f)
    }
}

impl<'gc, T: PartialEq + ?Sized + 'gc> PartialEq for Gc<'gc, T> {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        **self == **other
    }
}

impl<'gc, T: Eq + ?Sized + 'gc> Eq for Gc<'gc, T> {}

impl<'gc, T: PartialOrd + ?Sized + 'gc> PartialOrd for Gc<'gc, T> {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        (**self).partial_cmp(other)
    }
}

impl<'gc, T: Ord + ?Sized + 'gc> Ord for Gc<'gc, T> {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        (**self).cmp(other)
    }
}

impl<'gc, T: Hash + ?Sized + 'gc> Hash for Gc<'gc, T> {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        (**self).hash(state)
    }
}

/// A weak pointer; in this backend it always upgrades.
pub struct GcWeak<'gc, T: ?Sized + 'gc> {
    gc: Gc<'gc, T>,
}

impl<'gc, T: ?Sized + 'gc> Copy for GcWeak<'gc, T> {}

impl<'gc, T: ?Sized + 'gc> Clone for GcWeak<'gc, T> {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

impl<'gc, T: ?Sized + 'gc> GcWeak<'gc, T> {
    #[inline]
    pub fn upgrade(self, _mc: &Mutation<'gc>) -> Option<Gc<'gc, T>> {
        Some(self.gc)
    }

    #[inline]
    pub fn is_dropped(self) -> bool {
        false
    }

    #[inline]
    pub fn ptr_eq(this: Self, other: Self) -> bool {
        Gc::ptr_eq(this.gc, other.gc)
    }
}

impl<'gc, T: ?Sized + 'gc> fmt::Debug for GcWeak<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("(GcWeak)")
    }
}

unsafe impl<'gc, T: ?Sized + 'gc> Collect<'gc> for GcWeak<'gc, T> {}

/// Allocation statistics.
#[derive(Clone)]
pub struct Metrics(());

impl Metrics {
    /// The number of allocations made by this process; nothing is freed.
    #[inline]
    pub fn total_gc_count(&self) -> usize {
        ALLOCATIONS.load(AtomicOrdering::Relaxed)
    }
}

/// A root object that is leaked along with everything it reaches.
pub struct Arena<R>
where
    R: for<'a> Rootable<'a>,
    for<'a> Root<'a, R>: Collect<'a>,
{
    root: *mut Root<'static, R>,
}

impl<R> Arena<R>
where
    R: for<'a> Rootable<'a>,
    for<'a> Root<'a, R>: Sized + Collect<'a>,
{
    pub fn new<F>(f: F) -> Self
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>) -> Root<'gc, R>,
    {
        Self {
            root: Box::into_raw(Box::new(f(&MUTATION))),
        }
    }

    pub fn try_new<F, E>(f: F) -> Result<Self, E>
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>) -> Result<Root<'gc, R>, E>,
    {
        Ok(Self {
            root: Box::into_raw(Box::new(f(&MUTATION)?)),
        })
    }

    #[inline]
    pub fn mutate<F, T>(&self, f: F) -> T
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>, &'gc Root<'gc, R>) -> T,
    {
        // SAFETY: the root is leaked, so it lives for `'static`. `f` is generic
        // over `'gc`, so the reference cannot escape the call.
        f(&MUTATION, unsafe { &*self.root })
    }

    #[inline]
    pub fn mutate_root<F, T>(&mut self, f: F) -> T
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>, &'gc mut Root<'gc, R>) -> T,
    {
        // SAFETY: as in `mutate`; `&mut self` makes this the only reference.
        f(&MUTATION, unsafe { &mut *self.root })
    }

    #[inline]
    pub fn metrics(&self) -> Metrics {
        Metrics(())
    }

    #[inline]
    pub fn collect_debt(&mut self) {}

    #[inline]
    pub fn finish_cycle(&mut self) {}

    #[inline]
    pub fn finish_marking(&mut self) -> Option<MarkedArena<'_, R>> {
        Some(MarkedArena(PhantomData))
    }
}

/// An arena whose marking phase is complete; a no-op in this backend.
pub struct MarkedArena<'a, R>(PhantomData<&'a mut Arena<R>>)
where
    R: for<'b> Rootable<'b>,
    for<'b> Root<'b, R>: Collect<'b>;

impl<R> MarkedArena<'_, R>
where
    R: for<'b> Rootable<'b>,
    for<'b> Root<'b, R>: Collect<'b>,
{
    #[inline]
    pub fn start_sweeping(self) {}
}

#[inline]
pub fn rootless_mutate<F, T>(f: F) -> T
where
    F: for<'gc> FnOnce(&'gc Mutation<'gc>) -> T,
{
    f(&MUTATION)
}

static ROOT_SETS: AtomicUsize = AtomicUsize::new(0);

/// Registry of roots that may be held outside an arena callback.
pub struct DynamicRootSet<'gc> {
    id: usize,
    _invariant: Invariant<'gc>,
}

impl<'gc> Copy for DynamicRootSet<'gc> {}

impl<'gc> Clone for DynamicRootSet<'gc> {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

impl<'gc> DynamicRootSet<'gc> {
    #[inline]
    pub fn new(_mc: &Mutation<'gc>) -> Self {
        Self {
            id: ROOT_SETS.fetch_add(1, AtomicOrdering::Relaxed),
            _invariant: PhantomData,
        }
    }

    #[inline]
    pub fn stash<R>(&self, _mc: &Mutation<'gc>, root: Gc<'gc, Root<'gc, R>>) -> DynamicRoot<R>
    where
        R: for<'a> Rootable<'a>,
        Root<'gc, R>: Sized,
    {
        DynamicRoot {
            set: self.id,
            ptr: Gc::as_ptr(root) as *const (),
            _root: PhantomData,
        }
    }

    /// # Panics
    ///
    /// Panics if `root` was stashed in a different set.
    #[inline]
    pub fn fetch<R>(&self, root: &DynamicRoot<R>) -> Gc<'gc, Root<'gc, R>>
    where
        R: for<'a> Rootable<'a>,
        Root<'gc, R>: Sized,
    {
        self.try_fetch(root).expect("mismatched root set")
    }

    #[inline]
    pub fn try_fetch<R>(
        &self,
        root: &DynamicRoot<R>,
    ) -> Result<Gc<'gc, Root<'gc, R>>, MismatchedRootSet>
    where
        R: for<'a> Rootable<'a>,
        Root<'gc, R>: Sized,
    {
        if !self.contains(root) {
            return Err(MismatchedRootSet);
        }
        // SAFETY: the pointer came from a leaked `Gc<'static, Root<'static, R>>`
        // (every `'gc` here is `'static`), so it is valid and correctly typed.
        Ok(Gc {
            ptr: unsafe { &*(root.ptr as *const Root<'gc, R>) },
            _invariant: PhantomData,
        })
    }

    #[inline]
    pub fn contains<R>(&self, root: &DynamicRoot<R>) -> bool
    where
        R: for<'a> Rootable<'a>,
    {
        root.set == self.id
    }
}

unsafe impl<'gc> Collect<'gc> for DynamicRootSet<'gc> {}

/// A `'static` handle to a leaked heap value.
pub struct DynamicRoot<R: for<'gc> Rootable<'gc>> {
    set: usize,
    ptr: *const (),
    _root: PhantomData<fn() -> R>,
}

impl<R: for<'gc> Rootable<'gc>> Clone for DynamicRoot<R> {
    #[inline]
    fn clone(&self) -> Self {
        Self {
            set: self.set,
            ptr: self.ptr,
            _root: PhantomData,
        }
    }
}

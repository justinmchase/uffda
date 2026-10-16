use core::{
    borrow::Borrow,
    cmp::Ordering,
    fmt,
    hash::{Hash, Hasher},
    marker::PhantomData,
    ops::Deref,
};

use crate::{Collect, MismatchedRootSet, Root, Rootable, Trace};

pub(crate) const NAME: &str = "gc-arena";

/// Adapts a [`Collect`] value to `gc_arena::Collect` so it can live in a
/// `gc_arena::Gc`.
#[repr(transparent)]
pub(crate) struct Traced<T: ?Sized>(T);

unsafe impl<'gc, T: ?Sized + Collect<'gc>> gc_arena::Collect<'gc> for Traced<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: gc_arena::collect::Trace<'gc>>(&self, cc: &mut C) {
        self.0.trace(&mut ArenaTracer(cc));
    }
}

/// Our [`Trace`] driven by a `gc_arena` tracer.
struct ArenaTracer<'a, C>(&'a mut C);

impl<'gc, C: gc_arena::collect::Trace<'gc>> Trace<'gc> for ArenaTracer<'_, C> {
    #[inline]
    fn trace_gc(&mut self, gc: ErasedGc<'gc>) {
        self.0.trace_gc(gc.0)
    }

    #[inline]
    fn trace_gc_weak(&mut self, gc: ErasedGcWeak<'gc>) {
        self.0.trace_gc_weak(gc.0)
    }
}

/// A `gc_arena` tracer driven by our [`Trace`], for delegating to
/// `gc_arena`'s own `Collect` impls.
struct HeapTracer<'a, T>(&'a mut T);

impl<'gc, T: Trace<'gc>> gc_arena::collect::Trace<'gc> for HeapTracer<'_, T> {
    #[inline]
    fn trace_gc(&mut self, gc: gc_arena::Gc<'gc, ()>) {
        self.0.trace_gc(ErasedGc(gc))
    }

    #[inline]
    fn trace_gc_weak(&mut self, gc: gc_arena::GcWeak<'gc, ()>) {
        self.0.trace_gc_weak(ErasedGcWeak(gc))
    }
}

#[doc(hidden)]
pub struct ErasedGc<'gc>(gc_arena::Gc<'gc, ()>);

#[doc(hidden)]
pub struct ErasedGcWeak<'gc>(gc_arena::GcWeak<'gc, ()>);

/// Allocation and write-barrier context, valid for one arena callback.
#[repr(transparent)]
pub struct Mutation<'gc>(gc_arena::Mutation<'gc>);

impl<'gc> Mutation<'gc> {
    #[inline]
    fn wrap<'a>(mc: &'a gc_arena::Mutation<'gc>) -> &'a Self {
        // SAFETY: `Mutation` is a `repr(transparent)` wrapper.
        unsafe { &*(mc as *const gc_arena::Mutation<'gc> as *const Self) }
    }

    #[inline]
    pub(crate) fn write_barrier<T: ?Sized + 'gc>(&self, gc: Gc<'gc, T>) {
        self.0.backward_barrier(gc_arena::Gc::erase(gc.inner), None);
    }
}

/// A pointer to a value in the heap.
pub struct Gc<'gc, T: ?Sized + 'gc> {
    inner: gc_arena::Gc<'gc, Traced<T>>,
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
    pub fn new(mc: &Mutation<'gc>, t: T) -> Self {
        Self {
            inner: gc_arena::Gc::new(&mc.0, Traced(t)),
        }
    }
}

impl<'gc, T: ?Sized + 'gc> Gc<'gc, T> {
    /// Borrows the value for the whole `'gc` lifetime, which `AsRef` cannot express.
    #[inline]
    #[allow(clippy::should_implement_trait)]
    pub fn as_ref(this: Self) -> &'gc T {
        &gc_arena::Gc::as_ref(this.inner).0
    }

    #[inline]
    pub fn downgrade(this: Self) -> GcWeak<'gc, T> {
        GcWeak {
            inner: gc_arena::Gc::downgrade(this.inner),
        }
    }

    #[inline]
    pub fn ptr_eq(this: Self, other: Self) -> bool {
        gc_arena::Gc::ptr_eq(this.inner, other.inner)
    }

    #[inline]
    pub fn as_ptr(this: Self) -> *const T {
        Self::as_ref(this) as *const T
    }
}

unsafe impl<'gc, T: ?Sized + 'gc> Collect<'gc> for Gc<'gc, T> {
    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        cc.trace_gc(ErasedGc(gc_arena::Gc::erase(self.inner)))
    }
}

impl<'gc, T: ?Sized + 'gc> Deref for Gc<'gc, T> {
    type Target = T;

    #[inline]
    fn deref(&self) -> &T {
        &self.inner.0
    }
}

impl<'gc, T: ?Sized + 'gc> AsRef<T> for Gc<'gc, T> {
    #[inline]
    fn as_ref(&self) -> &T {
        self
    }
}

impl<'gc, T: ?Sized + 'gc> Borrow<T> for Gc<'gc, T> {
    #[inline]
    fn borrow(&self) -> &T {
        self
    }
}

impl<'gc, T: fmt::Debug + ?Sized + 'gc> fmt::Debug for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, f)
    }
}

impl<'gc, T: fmt::Display + ?Sized + 'gc> fmt::Display for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&**self, f)
    }
}

impl<'gc, T: ?Sized + 'gc> fmt::Pointer for Gc<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&Gc::as_ptr(*self), f)
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

/// A weak pointer that does not keep its target alive.
pub struct GcWeak<'gc, T: ?Sized + 'gc> {
    inner: gc_arena::GcWeak<'gc, Traced<T>>,
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
    pub fn upgrade(self, mc: &Mutation<'gc>) -> Option<Gc<'gc, T>> {
        self.inner.upgrade(&mc.0).map(|inner| Gc { inner })
    }

    #[inline]
    pub fn is_dropped(self) -> bool {
        self.inner.is_dropped()
    }

    #[inline]
    pub fn ptr_eq(this: Self, other: Self) -> bool {
        gc_arena::GcWeak::ptr_eq(this.inner, other.inner)
    }
}

impl<'gc, T: ?Sized + 'gc> fmt::Debug for GcWeak<'gc, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("(GcWeak)")
    }
}

unsafe impl<'gc, T: ?Sized + 'gc> Collect<'gc> for GcWeak<'gc, T> {
    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        cc.trace_gc_weak(ErasedGcWeak(gc_arena::GcWeak::erase(self.inner)))
    }
}

/// Lifts our [`Rootable`] to `gc_arena::Rootable` with a [`Traced`] root.
struct Rooted<R: ?Sized>(PhantomData<R>);

impl<'a, R: ?Sized + Rootable<'a>> gc_arena::Rootable<'a> for Rooted<R> {
    type Root = Traced<Root<'a, R>>;
}

/// Allocation and collection statistics.
#[derive(Clone)]
pub struct Metrics(gc_arena::metrics::Metrics);

impl Metrics {
    /// The number of live heap allocations.
    #[inline]
    pub fn total_gc_count(&self) -> usize {
        self.0.total_gc_count()
    }
}

/// A heap together with its single root object.
pub struct Arena<R>
where
    R: for<'a> Rootable<'a>,
    for<'a> Root<'a, R>: Collect<'a>,
{
    inner: gc_arena::Arena<Rooted<R>>,
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
            inner: gc_arena::Arena::new(|mc| Traced(f(Mutation::wrap(mc)))),
        }
    }

    pub fn try_new<F, E>(f: F) -> Result<Self, E>
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>) -> Result<Root<'gc, R>, E>,
    {
        Ok(Self {
            inner: gc_arena::Arena::try_new(|mc| f(Mutation::wrap(mc)).map(Traced))?,
        })
    }

    #[inline]
    pub fn mutate<F, T>(&self, f: F) -> T
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>, &'gc Root<'gc, R>) -> T,
    {
        self.inner.mutate(|mc, root| f(Mutation::wrap(mc), &root.0))
    }

    #[inline]
    pub fn mutate_root<F, T>(&mut self, f: F) -> T
    where
        F: for<'gc> FnOnce(&'gc Mutation<'gc>, &'gc mut Root<'gc, R>) -> T,
    {
        self.inner
            .mutate_root(|mc, root| f(Mutation::wrap(mc), &mut root.0))
    }

    #[inline]
    pub fn metrics(&self) -> Metrics {
        Metrics(self.inner.metrics().clone())
    }

    /// Performs collection work proportional to allocation since the last
    /// call.
    #[inline]
    pub fn collect_debt(&mut self) {
        self.inner.collect_debt()
    }

    /// Runs the current collection cycle to completion, freeing everything
    /// unreachable from the root.
    #[inline]
    pub fn finish_cycle(&mut self) {
        self.inner.finish_cycle()
    }

    /// Marks everything reachable, stopping before any memory is freed.
    #[inline]
    pub fn finish_marking(&mut self) -> Option<MarkedArena<'_, R>> {
        self.inner.finish_marking().map(MarkedArena)
    }
}

/// An arena whose marking phase is complete.
pub struct MarkedArena<'a, R>(gc_arena::arena::MarkedArena<'a, Rooted<R>>)
where
    R: for<'b> Rootable<'b>,
    for<'b> Root<'b, R>: Collect<'b>;

impl<R> MarkedArena<'_, R>
where
    R: for<'b> Rootable<'b>,
    for<'b> Root<'b, R>: Collect<'b>,
{
    /// Begins freeing unreachable allocations.
    #[inline]
    pub fn start_sweeping(self) {
        self.0.start_sweeping()
    }
}

/// Runs `f` with a temporary heap that is discarded afterward.
#[inline]
pub fn rootless_mutate<F, T>(f: F) -> T
where
    F: for<'gc> FnOnce(&'gc Mutation<'gc>) -> T,
{
    gc_arena::arena::rootless_mutate(|mc| f(Mutation::wrap(mc)))
}

/// Registry of roots that may be held outside an arena callback.
#[derive(Copy, Clone)]
pub struct DynamicRootSet<'gc>(gc_arena::DynamicRootSet<'gc>);

impl<'gc> DynamicRootSet<'gc> {
    #[inline]
    pub fn new(mc: &Mutation<'gc>) -> Self {
        Self(gc_arena::DynamicRootSet::new(&mc.0))
    }

    #[inline]
    pub fn stash<R>(&self, mc: &Mutation<'gc>, root: Gc<'gc, Root<'gc, R>>) -> DynamicRoot<R>
    where
        R: for<'a> Rootable<'a>,
        Root<'gc, R>: Sized,
    {
        DynamicRoot(self.0.stash::<Rooted<R>>(&mc.0, root.inner))
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
        Gc {
            inner: self.0.fetch(&root.0),
        }
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
        self.0
            .try_fetch(&root.0)
            .map(|inner| Gc { inner })
            .map_err(|_| MismatchedRootSet)
    }

    #[inline]
    pub fn contains<R>(&self, root: &DynamicRoot<R>) -> bool
    where
        R: for<'a> Rootable<'a>,
    {
        self.0.contains(&root.0)
    }
}

unsafe impl<'gc> Collect<'gc> for DynamicRootSet<'gc> {
    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        gc_arena::Collect::trace(&self.0, &mut HeapTracer(cc))
    }
}

/// A `'static` handle that keeps a heap value alive while it exists.
pub struct DynamicRoot<R: for<'gc> Rootable<'gc>>(gc_arena::DynamicRoot<Rooted<R>>);

impl<R: for<'gc> Rootable<'gc>> Clone for DynamicRoot<R> {
    #[inline]
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

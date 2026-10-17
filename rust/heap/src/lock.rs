use core::{
    cell::{BorrowError, BorrowMutError, Ref, RefCell, RefMut},
    fmt,
};

use crate::{Collect, Gc, Mutation, Trace};

/// Interior mutability for values stored in the heap.
///
/// Mutable access through a `Gc<RefLock<T>>` requires a [`Mutation`] so the
/// collector can observe the write (a write barrier).
#[derive(Default)]
pub struct RefLock<T: ?Sized> {
    cell: RefCell<T>,
}

impl<T> RefLock<T> {
    #[inline]
    pub fn new(t: T) -> Self {
        Self {
            cell: RefCell::new(t),
        }
    }

    #[inline]
    pub fn into_inner(self) -> T {
        self.cell.into_inner()
    }

    #[inline]
    pub fn take(&self) -> T
    where
        T: Default,
    {
        self.cell.take()
    }
}

impl<T: ?Sized> RefLock<T> {
    #[inline]
    pub fn borrow(&self) -> Ref<'_, T> {
        self.cell.borrow()
    }

    #[inline]
    pub fn try_borrow(&self) -> Result<Ref<'_, T>, BorrowError> {
        self.cell.try_borrow()
    }

    #[inline]
    pub fn get_mut(&mut self) -> &mut T {
        self.cell.get_mut()
    }
}

impl<T: fmt::Debug + ?Sized> fmt::Debug for RefLock<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.cell, f)
    }
}

// Collection only runs between arena callbacks, and no `RefMut` can outlive a
// callback because it borrows from a `'gc` pointer, so the cell is never
// mutably borrowed while it is traced.
unsafe impl<'gc, T: Collect<'gc> + ?Sized> Collect<'gc> for RefLock<T> {
    const NEEDS_TRACE: bool = T::NEEDS_TRACE;

    #[inline]
    fn trace<C: Trace<'gc>>(&self, cc: &mut C) {
        let value = self
            .cell
            .try_borrow()
            .expect("RefLock traced while mutably borrowed");
        cc.trace(&*value);
    }
}

impl<'gc, T: ?Sized + 'gc> Gc<'gc, RefLock<T>> {
    #[inline]
    pub fn borrow(self) -> Ref<'gc, T> {
        Gc::as_ref(self).cell.borrow()
    }

    #[inline]
    pub fn try_borrow(self) -> Result<Ref<'gc, T>, BorrowError> {
        Gc::as_ref(self).cell.try_borrow()
    }

    #[inline]
    pub fn borrow_mut(self, mc: &Mutation<'gc>) -> RefMut<'gc, T>
    where
        T: Collect<'gc>,
    {
        mc.write_barrier(self);
        Gc::as_ref(self).cell.borrow_mut()
    }

    #[inline]
    pub fn try_borrow_mut(self, mc: &Mutation<'gc>) -> Result<RefMut<'gc, T>, BorrowMutError>
    where
        T: Collect<'gc>,
    {
        mc.write_barrier(self);
        Gc::as_ref(self).cell.try_borrow_mut()
    }
}

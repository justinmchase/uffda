//! Serialize tests that construct a `Languages` / GC heap. Parallel cargo
//! threads otherwise race and abort with SIGSEGV / `free(): invalid pointer`.

use std::sync::{Mutex, MutexGuard};

static LANGUAGES_LOCK: Mutex<()> = Mutex::new(());

pub fn languages_lock() -> MutexGuard<'static, ()> {
    LANGUAGES_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

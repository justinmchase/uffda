---
id: memo-eviction-001
title: Memo entries strictly before the low-water mark are evicted; entries at or after it are retained
spec_ref: ".agents/specifications/runtime/memo-eviction.spec.md#core-contract"
---

# Low-Water-Mark Eviction

## Requirement

Preconditions:

- A packrat memo table tracks the start positions of all currently-active (not
  yet returned) rule frames.
- One or more memo entries exist at various stream positions.

Expected behavior:

- The runtime MUST compute the low-water mark as the minimum start position
  among all currently-active rule frames.
- When the active-frame stack is non-empty, the runtime MUST evict every memo
  entry whose position is strictly before the low-water mark.
- The runtime MUST NOT evict a memo entry whose position is at or after the
  low-water mark while any frame remains active.
- When the active-frame stack becomes empty (the outermost rule frame has
  returned), the runtime MUST evict every remaining memo entry: nothing further
  can revisit any position once evaluation is complete for that parse.

Error behavior:

- N/A — eviction is a memory-management operation; it MUST NOT raise or
  otherwise change match outcomes.

Postconditions:

- After eviction runs, the memo table MUST contain only entries at or after the
  current low-water mark (or be empty, if no frame remains active).
- A grammar's match outcome (success, failure, error, matched value, and
  diagnostics) MUST be identical whether or not eviction ran.

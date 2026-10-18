---
id: error-recovery-003
title: Ordered choice prefers a clean alternative over a recovered one
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#ordered-choice"
---

# Ordered Choice Prefers Clean Alternatives

## Requirement

Preconditions:

- An or pattern is evaluated with recovery enabled, and one or more of its
  alternatives succeed recovered.

Expected behavior:

- The or pattern MUST continue past a recovered alternative and MUST succeed
  with the first later alternative that succeeds clean, if any.
- With no clean alternative, the or pattern MUST succeed with the first
  recovered alternative.
- Each recovered alternative not chosen MUST appear among the or pattern's
  children as a `Fail` of that alternative's pattern whose sole child is the
  alternative's `Ok`, in alternative order.
- Errors and left-recursion outcomes MUST still be propagated immediately.

Postconditions:

- With recovery disabled, or pattern behavior MUST be unchanged.

## Test plan

`rust/src/pattern/tests.rs`: a later clean alternative wins, the first recovered
alternative wins when none is clean, and a passed-over recovered alternative is
a `Fail` whose only child is that alternative's success.

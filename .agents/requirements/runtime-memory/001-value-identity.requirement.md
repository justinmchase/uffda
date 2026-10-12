---
id: runtime-memory-001
title: Collection preserves primitive semantics and aggregate identity
spec_ref: ".agents/specifications/runtime/memory-management.spec.md#value-identity"
---

# Value identity

## Requirement

Expected behavior:

- Null and undefined MUST compare unequal.
- NaN MUST compare unequal to itself; positive and negative zero MUST compare
  equal.
- Separately allocated strings with equal contents MUST compare equal.
- Separately allocated arrays or objects with equal contents MUST compare
  unequal.
- Copying a reference MUST preserve identity and shared contents across
  collection.

Postconditions:

- Tests: `rust/src/value.rs` and `rust/src/gc_tests.rs`.

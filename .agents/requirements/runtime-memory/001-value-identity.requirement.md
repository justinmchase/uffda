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
- Separately allocated arrays, objects, Maps, or Sets with equal contents MUST
  compare unequal; comparing any of these values with itself MUST succeed.
- Copying a reference MUST preserve identity and shared contents across
  collection.
- The `id` global MUST return the exact input reference for aggregate values.
- The `coalesce` global MUST return the exact selected non-nullish reference.
- Repeated calls to `symbol` with the same well-known or registered name MUST
  return the same symbol identity.
- `slice` on an array MUST retain the references of selected elements.
- `slice` on a root-origin string MUST preserve each selected character's
  original input offset.

Postconditions:

- Tests: `rust/src/value.rs`, `rust/src/gc_tests.rs`,
  `rust/src/globals/tests.rs`, `src/runtime/globals/symbol.test.ts`, and
  `src/runtime/globals/slice.test.ts`. `eq` and `id` identity assertions are in
  `rust/src/globals/tests.rs`.

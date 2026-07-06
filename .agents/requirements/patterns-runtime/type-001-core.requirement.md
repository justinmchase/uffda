---
id: type-001
title: Type matches one item by runtime type
spec_ref: ".agents/specifications/patterns/runtime/type.spec.md"
---

# Type Core Semantics

## Requirement

Preconditions:

- Type pattern declares runtime type T and is evaluated at position P.

Expected behavior:

- Type MUST inspect one item at P and determine runtime type.
- Type MUST succeed and consume one item when item type equals T.
- Type MUST fail without consumption on mismatch or end-of-input.

Postconditions:

- Success output MUST be the consumed typed item.

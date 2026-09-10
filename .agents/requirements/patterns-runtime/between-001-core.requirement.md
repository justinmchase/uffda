---
id: between-001
title: Between matches one item within inclusive bounds
spec_ref: ".agents/specifications/patterns/runtime/between.spec.md"
---

# Between Core Semantics

## Requirement

Preconditions:

- Between pattern declares left and right bounds and is evaluated at position P.

Expected behavior:

- Between MUST inspect the current item at P and compare inclusively to bounds.
- Between MUST succeed only when value is within `[left, right]`, `[left, +∞)`
  when only `left` is set, or `(-∞, right]` when only `right` is set, and
  consume one item.
- Between MUST reject patterns with neither bound.
- Between MUST fail without consumption when value is out of bounds or
  unavailable.

Postconditions:

- Success output MUST be the consumed in-range value.

---
id: expressions-runtime-004
title: String expressions concatenate literal and embedded segments in order
spec_ref: ".agents/specifications/expressions/string.spec.md#behavioral-expectations; .agents/specifications/expressions/string.spec.md#interpolation-semantics"
---

# String Expression Composition

## Requirement

Preconditions:

- The runtime evaluates a string expression containing literal string segments,
  embedded expression segments, or both.

Expected behavior:

- The runtime MUST evaluate segments in declaration order.
- Literal string segments MUST be appended as-is.
- Embedded expression segments MUST be evaluated and converted to string
  representation.
- The final string MUST preserve source segment ordering.

Postconditions:

- String expression evaluation yields a deterministic concatenated string.

---
id: pattern-matching-001
title: Pattern matching preserves distinct outcome categories and supports scalar non-string inputs
spec_ref: ".agents/specifications/patterns/pattern-matching.spec.md#outcome-categories; .agents/specifications/patterns/pattern-matching.spec.md#failure-semantics; .agents/specifications/patterns/pattern-matching.spec.md#error-semantics; .agents/specifications/patterns/pattern-matching.spec.md#non-string-matching-surfaces"
---

# Pattern Matching Outcome Boundaries

## Requirement

Preconditions:

- A pattern is evaluated against an active runtime scope and current input
  position.

Expected behavior:

- Ordinary non-match behavior MUST report failure rather than runtime error.
- Runtime defects or unsupported runtime conditions MUST report error rather
  than ordinary failure.
- Scalar non-string values MUST remain matchable as one input item when scalar
  normalization is used.

Postconditions:

- Callers can distinguish non-match from runtime error through the reported
  outcome kind.

---
id: runtime-core-007
title: Patterns complete synchronously over immediate input and sequential composites behave identically across awaitable children
spec_ref: ".agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary; .agents/specifications/patterns/pattern-matching.spec.md#composition-and-delegation"
---

# Synchronous Completion and Sequential Composites

## Requirement

Preconditions:

- A pattern that does not reference a rule is matched against an input stream.
- The same pattern is matched against the same items supplied once as an
  immediately available iterable (for example a string) and once as an async
  iterable.

Expected behavior:

- Over an immediately available iterable, matching MUST return a match, not a
  promise.
- Over an async iterable, matching MUST return a promise.
- Sequential composites (`Then`, `And`, `Or`, `Over`, `Quantifier`) MUST produce
  the same match kind, value, and end position in both cases, including when a
  composite continues past children that completed asynchronously.
- An expression exception inside a projection MUST be normalized to the same
  `ExpressionException` error match whether the expression throws synchronously
  or rejects asynchronously.
- A thenable that is not a native promise MUST be adopted like a promise.

Postconditions:

- Synchronous completion is an optimization only: callers that await results
  observe identical outcomes either way.

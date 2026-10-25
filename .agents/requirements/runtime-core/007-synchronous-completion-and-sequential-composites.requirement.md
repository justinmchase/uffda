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

- Rust MUST represent input availability in execution state, not first-class
  Promise values. The retired TypeScript host used matches for immediate input
  and awaitables for async input; it is not required to run acceptance tests.
- Sequential composites (`Then`, `And`, `Or`, `Over`, `Quantifier`) MUST produce
  the same match kind, value, and end position in both cases, including when a
  composite continues past children that completed asynchronously.
- An expression exception inside a projection MUST be normalized to the same
  `ExpressionException` error match whether the expression throws synchronously
  or rejects asynchronously.
- Rust data objects with a `then` property MUST remain data; actual host
  suspension is explicit. The retired TypeScript host adopted thenables like
  promises.
- Rust native and authored hook invocations MUST consume their completed values
  through the same continuation scheduler. Pending execution MUST NOT become an
  empty-object serialization or protocol placeholder.
- Suspended Rust execution MUST retain live roots without holding a collector
  mutation context or borrow across a host await.

Postconditions:

- Synchronous completion is an optimization only: callers that await results
  observe identical outcomes either way.

## Test plan

- `src/evaluate/tests.rs`, `src/globals/tests.rs`,
  `src/runtime/module_ports.rs`, `src/runtime/scope_ports.rs`,
  `src/runtime/tests.rs`

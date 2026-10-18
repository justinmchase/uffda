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

- In the TypeScript host, immediate input MUST return a match and async input
  MUST return an awaitable. Rust MUST represent availability in execution state,
  not first-class Promise values.
- Sequential composites (`Then`, `And`, `Or`, `Over`, `Quantifier`) MUST produce
  the same match kind, value, and end position in both cases, including when a
  composite continues past children that completed asynchronously.
- An expression exception inside a projection MUST be normalized to the same
  `ExpressionException` error match whether the expression throws synchronously
  or rejects asynchronously.
- TypeScript thenables MUST be adopted like promises. Rust data objects with a
  `then` property MUST remain data; actual host suspension is explicit.
- Rust native and authored hook invocations MUST consume their completed values
  through the same continuation scheduler. Pending execution MUST NOT become an
  empty-object serialization or protocol placeholder.
- Suspended Rust execution MUST retain live roots without holding a collector
  mutation context or borrow across a host await.

Postconditions:

- Synchronous completion is an optimization only: callers that await results
  observe identical outcomes either way.

## Test plan

- `rust/src/evaluate/tests.rs`, `rust/src/globals/tests.rs`, `rust/src/runtime/module_ports.rs`, `rust/src/runtime/scope_ports.rs`, `rust/src/runtime/tests.rs`

---
id: expressions-runtime-008
title: Exec returns promises while preserving awaitable propagation semantics
spec_ref: ".agents/specifications/expressions/runtime-semantics.spec.md#async-capable-by-default-model; .agents/specifications/expressions/runtime-semantics.spec.md#composition-and-propagation; .agents/specifications/expressions/runtime-semantics.spec.md#performance-requirements"
---

# Promise Exec and Awaitable Propagation

## Requirement

Preconditions:

- The runtime evaluates a composite expression tree whose child expressions may
  be immediate values or awaitable values.

Expected behavior:

- Exec MUST return a `Promise<unknown>` for every expression evaluation.
- If any child evaluation yields an awaitable value, composite evaluation MUST
  propagate awaitable semantics to the parent result.
- Composite expression evaluation MUST preserve declaration order when resolving
  child expressions.

Postconditions:

- Runtime expression evaluation remains deterministic for both immediate and
  async-capable projection behavior under a promise-returning execution API.

---
id: expressions-runtime-008
title: Exec completes synchronously for immediate children and propagates awaitables otherwise
spec_ref: ".agents/specifications/expressions/runtime-semantics.spec.md#async-capable-by-default-model; .agents/specifications/expressions/runtime-semantics.spec.md#composition-and-propagation; .agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary"
---

# Synchronous Exec and Awaitable Propagation

## Requirement

Preconditions:

- The runtime evaluates a composite expression tree whose child expressions may
  be immediate values or awaitable values.

Expected behavior:

- If every child evaluation yields an immediate value, exec MUST return the
  resulting value itself, not a promise.
- If any child evaluation yields an awaitable value, composite evaluation MUST
  propagate awaitable semantics to the parent result, and exec MUST return a
  promise resolving to the same value the synchronous path would produce.
- Composite expression evaluation MUST preserve declaration order when resolving
  child expressions, evaluating each child only after the previous one has
  completed.

Postconditions:

- Runtime expression evaluation remains deterministic for both immediate and
  async-capable projection behavior.

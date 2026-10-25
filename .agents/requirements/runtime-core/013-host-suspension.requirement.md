---
id: runtime-core-013
title: External host calls suspend with rooted arguments and safe completion
spec_ref: ".agents/specifications/runtime/host-execution.spec.md#constraints; .agents/specifications/runtime/host-execution.spec.md#mechanism"
---

# External host calls suspend with rooted arguments and safe completion

## Requirement

Preconditions:

- The host registers an explicit host callable in an expression environment.

Expected behavior:

- Call dispatch MUST yield a named, identified request with rooted arguments.
- Steps while a request is outstanding MUST report suspension without consuming
  the continuation or evaluating later children.
- Direct completion and an executor-independent future driver MUST resume the
  same continuation. Actual pending futures MUST wake and complete correctly.
- Collection between suspension and completion MUST preserve argument contents
  and composite result identity.
- A safe arena re-entry materializer MUST support non-scalar results.
- Foreign retained values and stale requests MUST fail explicitly.
- A host failure MUST normalize to a sticky host evaluation error.
- Dropping the driver MUST drop its future and request roots; explicit
  cancellation MUST release suspended execution state.
- Cooperative yields MUST wake the caller; immediate native and authored calls
  MUST continue to work without a host executor.
- Pattern projections, Into and Pipeline drains, authored parameter patterns,
  and runtime rule frames MUST forward host requests and resume their owning
  expression subexecutions. Runtime cancellation and errors MUST release pending
  frame and memo dependency roots; host calls MUST NOT become rule requests.

Postconditions:

- No future or Promise appears in a runtime value.
- Tests: `src/evaluate/tests.rs`, `src/value.rs`,
  `src/coercion.rs`, `src/globals/tests.rs`, `src/output.rs`,
  `src/pattern/tests.rs`, `src/runtime/tests.rs`.

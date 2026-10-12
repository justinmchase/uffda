---
id: runtime-core-014
title: External input is lazily delivered and cached across suspension
spec_ref: ".agents/specifications/runtime/async-input.spec.md#constraints; .agents/specifications/runtime/async-input.spec.md#mechanism"
---

# External input is lazily delivered and cached across suspension

## Requirement

Preconditions:

- Pattern or rule execution receives an explicit external input source.

Expected behavior:

- Unknown availability MUST suspend before item-consuming or EOF-sensitive
  matching, without producing failure, EOF, or a completed memo.
- Each request MUST deliver one arbitrary rooted or materialized value, explicit
  EOF, or a sticky source error.
- Revisited cached positions MUST not request delivery again. Input identity
  MUST remain stable across appends and rule calls.
- Root and nested Into sources MUST preserve sequential matching and structural
  paths; quantifiers MUST wait for actual availability.
- The shared external driver MUST support real pending futures and wakeups
  outside collector mutation scopes, without read-ahead.
- Foreign completions and stale requests MUST fail explicitly. Cancellation MUST
  drop pending futures and permit unreachable prefix graphs to collect.
- Appending MUST structurally share old prefix storage. An immutable prefix of
  length N MUST retain its length and values after subsequent deliveries.
  Appending an item MUST allocate no more than one leaf plus a logarithmic
  number of branch nodes, without copying earlier item values.

Postconditions:

- Synchronous iterable semantics and existing host-call APIs remain available.
- Tests: `rust/src/runtime/input.rs`, `rust/src/pattern/tests.rs`,
  `rust/src/runtime/tests.rs`, `rust/src/evaluate/tests.rs`.

---
id: skip-001
title: Skip consumes its child's input and reports a skipped success
spec_ref: ".agents/specifications/patterns/runtime/skip.spec.md"
---

# Skip Core Semantics

## Requirement

Preconditions:

- Skip pattern with child pattern `P` is evaluated at position S.

Expected behavior:

- When `P` succeeds (ordinarily or skipped), skip MUST report a skipped success
  (`MatchKind.Skip`) whose value is `undefined`.
- When `P` fails, skip MUST fail without consuming input.
- When `P` reports an error or a left-recursion outcome, skip MUST propagate it
  unchanged.
- Skip MUST keep the bindings produced by `P`.

Postconditions:

- On success, the caller-visible position MUST equal the position after `P`.
- On failure, the caller-visible position MUST remain S.
- A top-level skipped success is a success whose host-visible value is
  `undefined`.

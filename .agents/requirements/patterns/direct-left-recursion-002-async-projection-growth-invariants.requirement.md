---
id: direct-left-recursion-002
title: Direct-left-recursive growth invariants hold when recursive rule projections are awaited
spec_ref: ".agents/specifications/patterns/direct-left-recursion.spec.md#behavioral-expectations; .agents/specifications/runtime/left-recursion.spec.md#growth-and-fixpoint-behavior"
---

# Async Projection Left-Recursion Growth Invariants

## Requirement

Preconditions:

- A directly left-recursive rule is evaluated through normal runtime
  rule-resolution flow.
- The rule projection expression may evaluate asynchronously.

Expected behavior:

- Left-recursive growth MUST continue to evaluate and compare progress at input
  position boundaries while projection values are awaited.
- A directly left-recursive rule with a base case MUST still stabilize to a
  successful fixed point.
- Unsupported indirect left recursion MUST remain rejected on the active
  evaluation path even when related projections are asynchronous.

Postconditions:

- Awaited expression projections do not alter direct vs indirect left-recursion
  acceptance semantics.

---
id: direct-left-recursion-002
title: Direct-left-recursive growth invariants hold when recursive rule projections are awaited
spec_ref: ".agents/specifications/patterns/direct-left-recursion.spec.md#behavioral-expectations; .agents/specifications/runtime/left-recursion.spec.md#detection-and-growth"
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
- A left-recursive cycle with no base case MUST still fail when a cycle
  participant's projection is asynchronous.

Postconditions:

- Awaited expression projections do not alter left-recursion growth or
  termination semantics.

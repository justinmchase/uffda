---
id: equal-005
title: Equal introduces no new error states and no external side effects
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md#error-conditions; .agents/specifications/patterns/runtime/equal.spec.md#side-effects"
---

# Equal Error and Side-Effect Boundaries

## Requirement

Preconditions:

- An equal pattern is evaluated in a valid runtime scope.

Expected behavior:

- The equal pattern MUST NOT introduce new equal-specific runtime error states.
- The equal pattern MUST NOT produce externally observable side effects beyond
  match result and resulting matching context.

Postconditions:

- Equal-pattern evaluation outcomes are limited to success/failure match
  semantics and resulting scope/input state transitions.

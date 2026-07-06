---
id: equal-001
title: Equal inspects the current input position and fails at end-of-input
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md#behavioral-expectations; .agents/specifications/patterns/runtime/equal.spec.md#input-consumption"
---

# Equal Inspects Current Position

## Requirement

Preconditions:

- An equal pattern is evaluated at caller-visible input position P.

Expected behavior:

- The equal pattern MUST inspect the current input position P.
- If no input item exists at position P, the equal pattern MUST fail.

Postconditions:

- End-of-input evaluation MUST return failure without changing caller-visible
  input position.

---
id: equal-004
title: Equal failure does not consume input and reports failure output
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md#behavioral-expectations; .agents/specifications/patterns/runtime/equal.spec.md#input-consumption; .agents/specifications/patterns/runtime/equal.spec.md#expected-output"
---

# Equal Failure Preserves Input Position

## Requirement

Preconditions:

- An equal pattern evaluation compares current input item I against literal L.
- `I !== L`, or end-of-input is reached.

Expected behavior:

- The equal pattern MUST fail.
- The equal pattern MUST NOT consume input.
- The equal pattern MUST report failure output.

Postconditions:

- Caller-visible input position MUST remain unchanged from the incoming
  position.

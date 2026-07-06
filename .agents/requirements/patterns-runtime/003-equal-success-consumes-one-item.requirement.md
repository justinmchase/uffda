---
id: equal-003
title: Equal success consumes exactly one item and reports the consumed value
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md#behavioral-expectations; .agents/specifications/patterns/runtime/equal.spec.md#input-consumption; .agents/specifications/patterns/runtime/equal.spec.md#expected-output"
---

# Equal Success Consumption and Output

## Requirement

Preconditions:

- An equal pattern evaluation compares current input item I against literal L.
- `I === L`.

Expected behavior:

- The equal pattern MUST succeed.
- The equal pattern MUST advance resulting input position by exactly one item.
- The equal pattern MUST consume exactly one input item.
- The equal pattern MUST report the consumed input item as output value.

Postconditions:

- On success, caller-visible scope/input state MUST reflect one-item consumption
  and output value I.

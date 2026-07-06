---
id: equal-002
title: Equal compares the current item using JavaScript strict equality
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md#behavioral-expectations"
---

# Equal Uses JavaScript Strict Equality

## Requirement

Preconditions:

- An equal pattern has a declared literal value L.
- An input item I is available at the current position.

Expected behavior:

- The equal pattern MUST compare I to L using JavaScript strict equality
  semantics (`===`).
- If `I === L`, the comparison outcome MUST be success.
- If `I !== L`, the comparison outcome MUST be failure.

Postconditions:

- Equal-pattern match behavior MUST be deterministic for a given pair `(I, L)`
  under strict equality semantics.

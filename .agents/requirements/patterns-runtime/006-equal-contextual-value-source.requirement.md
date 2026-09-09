---
id: equal-006
title: Equal resolves contextual value sources
spec_ref: ".agents/specifications/patterns/runtime/equal.spec.md"
---

# Equal contextual value sources

## Requirement

Preconditions:

- An equal pattern declares a value operand that is either a literal or a
  `$name` value source.
- Match scope may contain variable bindings.

Expected behavior:

- Equal MUST resolve `$name` from `scope.variables` before comparing.
- Equal MUST succeed when the current item is strictly equal to the resolved
  value.
- Equal MUST report an unknown-reference error when `$name` is unbound.

Postconditions:

- Legacy bare literal operands continue to work unchanged.

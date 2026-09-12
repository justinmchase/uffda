---
id: switch-003
title: Switch falls back to default or fails when no case key matches
spec_ref: ".agents/specifications/patterns/runtime/switch.spec.md#behavioral-expectations"
---

# Switch Default and No-Match Semantics

## Requirement

Preconditions:

- Switch pattern is evaluated at position P and no declared case key matches the
  current input item (including when no input item is available, i.e. end of
  input).

Expected behavior:

- If a `default` pattern is declared, Switch MUST evaluate and return the
  `default` pattern's result.
- If no `default` pattern is declared, Switch MUST fail as a plain failure
  (never an error).
- A Switch pattern with no cases and no `default` MUST fail for any input.

Postconditions:

- On no-match-without-default failure, caller-visible position MUST remain P.

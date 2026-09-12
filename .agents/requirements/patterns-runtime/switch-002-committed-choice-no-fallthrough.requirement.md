---
id: switch-002
title: Switch is committed choice - a matching key's failing body does not fall through
spec_ref: ".agents/specifications/patterns/runtime/switch.spec.md#behavioral-expectations"
---

# Switch Committed-Choice Semantics

## Requirement

Preconditions:

- Switch pattern is evaluated at position P and a case's key matches the current
  input item.

Expected behavior:

- Switch MUST evaluate that case's body pattern against position P.
- If that body pattern fails, Switch MUST fail; it MUST NOT try any other case's
  key or body, even if a later case's key (or `default`) would have matched and
  succeeded.
- If that body pattern reports an error, Switch MUST propagate that error and
  MUST NOT try any other case.

Postconditions:

- On a chosen case's body failure, caller-visible position MUST remain P.

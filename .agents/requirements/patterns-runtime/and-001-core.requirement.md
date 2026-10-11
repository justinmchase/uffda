---
id: and-001
title: And evaluates children at one position and forwards the final outcome
spec_ref: ".agents/specifications/patterns/runtime/and.spec.md"
---

# And Core Semantics

## Requirement

Preconditions:

- An and pattern is evaluated at caller-visible input position P.

Expected behavior:

- The and pattern MUST evaluate child patterns at the same caller-visible input
  position.
- The and pattern MUST succeed only when all child patterns succeed.
- The and pattern MUST NOT consume input directly.
- Bindings from successful earlier children MUST be available to later children
  without advancing their input position.
- Success MUST forward the final child's value, skip status, and consumed
  position. The empty conjunction MUST succeed at P with undefined output.

Postconditions:

- A failed conjunction MUST restore caller-visible input position P.
- A successful nonempty conjunction MUST expose its final child's position;
  child consumption is not suppressed by the conjunction.

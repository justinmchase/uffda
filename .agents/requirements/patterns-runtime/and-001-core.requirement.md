---
id: and-001
title: And is a zero-width conjunction over child patterns
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

Postconditions:

- On both success and failure, caller-visible input position MUST remain P.

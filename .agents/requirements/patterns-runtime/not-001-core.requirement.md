---
id: not-001
title: Not is a zero-width negative assertion
spec_ref: ".agents/specifications/patterns/runtime/not.spec.md"
---

# Not Core Semantics

## Requirement

Preconditions:

- Not pattern with child pattern is evaluated at position P.

Expected behavior:

- Not MUST succeed when child fails at P.
- Not MUST fail when child succeeds at P.
- Not MUST NOT consume input directly.

Postconditions:

- Caller-visible position MUST remain P in all non-error outcomes.

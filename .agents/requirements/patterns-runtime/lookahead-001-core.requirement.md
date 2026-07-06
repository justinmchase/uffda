---
id: lookahead-001
title: Lookahead is a zero-width positive assertion
spec_ref: ".agents/specifications/patterns/runtime/lookahead.spec.md"
---

# Lookahead Core Semantics

## Requirement

Preconditions:

- Lookahead pattern with child pattern is evaluated at position P.

Expected behavior:

- Lookahead MUST succeed only when child pattern succeeds at P.
- Lookahead MUST NOT consume input in any outcome.

Postconditions:

- Caller-visible input position MUST remain P for success and failure.

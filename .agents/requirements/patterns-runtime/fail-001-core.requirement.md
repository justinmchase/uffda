---
id: fail-001
title: Fail always fails and never consumes input
spec_ref: ".agents/specifications/patterns/runtime/fail.spec.md"
---

# Fail Core Semantics

## Requirement

Preconditions:

- Fail pattern is evaluated at position P.

Expected behavior:

- Fail MUST return failure in all cases.
- Fail MUST NOT consume input.

Postconditions:

- Caller-visible position MUST remain P.

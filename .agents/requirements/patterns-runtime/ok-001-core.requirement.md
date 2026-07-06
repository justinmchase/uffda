---
id: ok-001
title: Ok always succeeds and never consumes input
spec_ref: ".agents/specifications/patterns/runtime/ok.spec.md"
---

# Ok Core Semantics

## Requirement

Preconditions:

- Ok pattern is evaluated at position P.

Expected behavior:

- Ok MUST succeed in all cases.
- Ok MUST NOT consume input.

Postconditions:

- Caller-visible input position MUST remain P.

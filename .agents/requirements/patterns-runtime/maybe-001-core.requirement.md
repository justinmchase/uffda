---
id: maybe-001
title: Maybe always succeeds and consumes only when child succeeds
spec_ref: ".agents/specifications/patterns/runtime/maybe.spec.md"
---

# Maybe Core Semantics

## Requirement

Preconditions:

- Maybe pattern with child pattern is evaluated at position P.

Expected behavior:

- Maybe MUST evaluate child at P.
- If child succeeds, maybe MUST return child success outcome and consumption.
- If child fails, maybe MUST succeed without consumption.

Postconditions:

- Maybe MUST never return failure unless child returns runtime error.

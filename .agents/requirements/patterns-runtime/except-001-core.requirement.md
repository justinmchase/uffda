---
id: except-001
title: Except is a zero-width negative assertion followed by one-item consumption
spec_ref: ".agents/specifications/patterns/runtime/except.spec.md"
---

# Except Core Semantics

## Requirement

Preconditions:

- Except pattern with child pattern is evaluated at position P.

Expected behavior:

- Child evaluation MUST be zero-width at position P.
- Except MUST consume one item and succeed only when child fails.
- Except MUST fail without consumption when child succeeds or at end-of-input.

Postconditions:

- Success output MUST be the consumed item.

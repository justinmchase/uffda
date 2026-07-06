---
id: includes-001
title: Includes matches one item contained in its declared value set
spec_ref: ".agents/specifications/patterns/runtime/includes.spec.md"
---

# Includes Core Semantics

## Requirement

Preconditions:

- Includes pattern has declared values and is evaluated at position P.

Expected behavior:

- Includes MUST inspect one item at P.
- Includes MUST succeed and consume one item when the item is in declared
  values.
- Includes MUST fail without consumption when item is missing or not included.

Postconditions:

- Success output MUST be the consumed included item.

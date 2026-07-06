---
id: any-001
title: Any consumes exactly one available input item
spec_ref: ".agents/specifications/patterns/runtime/any.spec.md"
---

# Any Core Semantics

## Requirement

Preconditions:

- Any pattern is evaluated at caller-visible input position P.

Expected behavior:

- If an input item exists at P, any MUST succeed.
- On success, any MUST consume exactly one item and advance position by one.
- If no input item exists at P, any MUST fail without consumption.

Postconditions:

- Success output MUST be the consumed input item.

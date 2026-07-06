---
id: then-001
title: Then composes child patterns sequentially
spec_ref: ".agents/specifications/patterns/runtime/then.spec.md"
---

# Then Core Semantics

## Requirement

Preconditions:

- Then pattern has ordered child patterns.

Expected behavior:

- Then MUST evaluate children in order.
- Then MUST fail immediately when any child fails.
- Then MUST consume input only through successful child consumption.

Postconditions:

- On success, output MUST be ordered child outputs.

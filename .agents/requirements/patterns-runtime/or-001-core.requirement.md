---
id: or-001
title: Or succeeds with the first successful child and preserves input on full failure
spec_ref: ".agents/specifications/patterns/runtime/or.spec.md"
---

# Or Core Semantics

## Requirement

Preconditions:

- Or pattern with ordered child patterns is evaluated at position P.

Expected behavior:

- Or MUST evaluate alternatives in declared order.
- Or MUST succeed using the first successful child outcome.
- Or MUST fail when all children fail.
- Or MUST NOT consume input directly.

Postconditions:

- On total failure, caller-visible position MUST remain P.

---
id: end-001
title: End succeeds only at end-of-input and never consumes
spec_ref: ".agents/specifications/patterns/runtime/end.spec.md"
---

# End Core Semantics

## Requirement

Preconditions:

- End pattern is evaluated at caller-visible position P.

Expected behavior:

- End MUST succeed only when position P is at end-of-input.
- End MUST fail when additional items are available.
- End MUST NOT consume input in any outcome.

Postconditions:

- Caller-visible position MUST remain P for both success and failure.

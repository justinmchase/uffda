---
id: into-001
title: Into evaluates child pattern against a nested iterable stream
spec_ref: ".agents/specifications/patterns/runtime/into.spec.md"
---

# Into Core Semantics

## Requirement

Preconditions:

- Into pattern with child pattern is evaluated at position P.

Expected behavior:

- Into MUST require the current item at P to be iterable.
- Into MUST evaluate child pattern against a nested stream from that iterable.
- Into MUST succeed only when child consumes the entire nested stream.
- Into MUST consume exactly one outer item on success.

Error behavior:

- Non-iterable current item MUST produce iterable-expected runtime error.

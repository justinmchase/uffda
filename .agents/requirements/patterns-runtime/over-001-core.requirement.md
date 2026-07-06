---
id: over-001
title: Over traverses keyed values through declared key patterns
spec_ref: ".agents/specifications/patterns/runtime/over.spec.md"
---

# Over Core Semantics

## Requirement

Preconditions:

- Over pattern with optional key map is evaluated at position P.

Expected behavior:

- Over MUST require current item at P to be keyed input (object or map surface).
- Over MUST evaluate each declared key pattern against a derived single-item
  stream for that key value.
- Over MUST consume exactly one outer item on success.
- Over MUST fail without consumption when keyed requirements are not satisfied.

Postconditions:

- Success output MUST be the consumed outer keyed value.

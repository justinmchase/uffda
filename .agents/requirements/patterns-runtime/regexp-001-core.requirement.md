---
id: regexp-001
title: RegExp matches one string item against declared regular expression
spec_ref: ".agents/specifications/patterns/runtime/regexp.spec.md"
---

# RegExp Core Semantics

## Requirement

Preconditions:

- RegExp pattern declares a regular expression and is evaluated at position P.

Expected behavior:

- RegExp MUST require a string input item at P.
- RegExp MUST succeed only when regular expression matches that string item.
- RegExp MUST consume exactly one item on success.
- RegExp MUST fail without consumption on mismatch or end-of-input.

Postconditions:

- Success output MUST be the consumed string input item.

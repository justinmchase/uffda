---
id: switch-001
title: Switch dispatches on declared case keys and commits to the first match
spec_ref: ".agents/specifications/patterns/runtime/switch.spec.md"
---

# Switch Core Semantics

## Requirement

Preconditions:

- Switch pattern with ordered cases, each with a declared key (`values` or
  `characterClass`) and a body pattern, is evaluated at position P.

Expected behavior:

- Switch MUST check case keys in declared order against the current input item,
  never against a case's body pattern.
- A `values` key MUST match when the current input item strictly equals any
  resolved value in the key's declared set.
- A `characterClass` key MUST match when the current input item is a string
  satisfying that Unicode character class.
- Switch MUST select the first case whose key matches and MUST evaluate only
  that case's body pattern.
- Switch MUST NOT consume input while checking keys.

Postconditions:

- Switch's own result MUST equal the chosen case's body pattern result exactly
  (success value, failure, error, or left-recursion outcome).

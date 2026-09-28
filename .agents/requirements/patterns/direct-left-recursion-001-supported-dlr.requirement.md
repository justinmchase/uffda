---
id: direct-left-recursion-001
title: Direct left recursion is supported with a base case and a left-recursive cycle without one fails
spec_ref: ".agents/specifications/patterns/direct-left-recursion.spec.md#pattern-level-model; .agents/specifications/patterns/direct-left-recursion.spec.md#behavioral-expectations; .agents/specifications/runtime/left-recursion.spec.md#supported-forms"
---

# Direct Left Recursion Support

## Requirement

Preconditions:

- A rule is evaluated through the runtime rule-resolution path.

Expected behavior:

- A directly left-recursive rule with a non-left-recursive base case MUST be
  accepted and stabilize to a successful match when input satisfies the rule.
- A left-recursive cycle with no base case (for example `a = b; b = a`) MUST
  fail and terminate rather than recurse without bound or raise an error.

Postconditions:

- Direct left recursion remains usable for left-associative rule authoring.
  Indirect and mutual left recursion are covered by
  `indirect-left-recursion-001`.

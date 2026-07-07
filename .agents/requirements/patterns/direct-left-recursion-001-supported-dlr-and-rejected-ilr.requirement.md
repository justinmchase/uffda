---
id: direct-left-recursion-001
title: Direct left recursion is supported with a base case and indirect left recursion is rejected on the active rule-evaluation path
spec_ref: ".agents/specifications/patterns/direct-left-recursion.spec.md#pattern-level-model; .agents/specifications/patterns/direct-left-recursion.spec.md#behavioral-expectations; .agents/specifications/patterns/direct-left-recursion.spec.md#supported-and-unsupported-forms"
---

# Direct Left Recursion Support and Rejection

## Requirement

Preconditions:

- A rule is evaluated through the runtime rule-resolution path.

Expected behavior:

- A directly left-recursive rule with a non-left-recursive base case MUST be
  accepted and stabilize to a successful match when input satisfies the rule.
- An indirectly left-recursive rule cycle MUST be rejected according to the
  active runtime path rather than being treated as a normal successful match.

Postconditions:

- Supported direct left recursion remains usable for left-associative rule
  authoring, while unsupported indirect left recursion is not silently accepted.

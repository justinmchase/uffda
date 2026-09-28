---
id: error-recovery-006
title: Left-recursive growth never accepts a recovered candidate
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#left-recursion"
---

# Left-Recursion Growth and Recovery

## Requirement

Preconditions:

- A direct-left-recursive rule is grown with recovery enabled, and a growth step
  produces a recovered candidate (for example because a recover pattern
  enclosing the recursive reference recovered from the seed's failure).

Expected behavior:

- Growth MUST stop without accepting the candidate; the rule's outcome MUST be
  the last accepted seed (a failure when no seed was accepted).
- Clean growth MUST be unaffected.

Postconditions:

- A seed failure MUST never surface as a recovery.

## Test plan

`src/runtime/rule.test.ts` (RULE_RECOVERY00):
`E = recover (E "+" "n") skip
any+ | "n"` fails on `x` (it would otherwise
recover `x` as an `E`) and grows cleanly over `n+n`.

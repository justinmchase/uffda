---
id: recover-001
title: Recover matches its child, or its skip pattern when recovering
spec_ref: ".agents/specifications/patterns/runtime/recover.spec.md"
---

# Recover Core Semantics

## Requirement

Preconditions:

- A recover pattern with child C and skip pattern S is evaluated at position P.

Expected behavior:

- Recover MUST evaluate C at P; if C succeeds, recover MUST succeed with C's
  value and consumption, and MUST NOT evaluate S.
- If C fails and recovery is disabled, recover MUST fail at P without evaluating
  S.
- If C fails and recovery is enabled, recover MUST evaluate S at P with recovery
  disabled. If S succeeds after consuming at least one item, recover MUST
  succeed with S's value and consumption, marked recovered, with children
  `[C's failure, S's success]`; otherwise recover MUST fail at P.
- Matching after a recovery MUST continue with recovery enabled.

Postconditions:

- Recover MUST only fail without consumption, and MUST propagate errors and
  left-recursion outcomes from C or S unchanged.

## Test plan

`src/runtime/patterns/recover.test.ts`: child success with and without recovery
(RECOVER00, RECOVER03), failure with recovery disabled (RECOVER01), recovery
span/value/children/setting (RECOVER02), zero-width skip fails (RECOVER04), skip
matched without recovery (RECOVER05), recovery continuing after a recovery
(RECOVER06), synchronous/async agreement (RECOVER_AWAITABLE).

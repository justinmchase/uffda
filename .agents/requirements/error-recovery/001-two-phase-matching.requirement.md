---
id: error-recovery-001
title: Entry points always match in two phases, recovering only when a clean parse fails
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#two-phase-matching; .agents/specifications/runtime/error-recovery.spec.md#host-surface"
---

# Two-Phase Matching

## Requirement

Preconditions:

- An entry point (executing a module declaration, or parsing with a grammar)
  matches pattern G at position P. No entry point offers a way to disable
  recovery.

Expected behavior:

- The runtime MUST first match G at P with recovery disabled (discovery).
- If discovery succeeds, or reports an error or left-recursion outcome, that
  outcome MUST be the result, and G MUST NOT be matched again.
- If discovery fails and the child of at least one recover pattern failed during
  discovery, the runtime MUST match G at P again with recovery enabled, and that
  outcome MUST be the result.
- If discovery fails without any recover pattern's child failing, the recovery
  phase MUST be skipped and discovery's failure MUST be the result.
- A discovery phase that reuses rehydrated incremental memo entries MUST assume
  a recover pattern's child failed exactly when the prior parse recorded one.
- The recovery setting MUST default to disabled for every evaluation context not
  derived from one that enabled it.
- A consumer that treats a result as clean MUST check that it is a success that
  is not recovered (`isClean`), not merely a success.

Postconditions:

- Every input G accepts without recovery MUST produce the same result as a match
  without recovery.

## Test plan

`src/runtime/recovery.test.ts`: clean input returns the discovery result
(RECOVERY00), failed discovery recovers (RECOVERY01), an error does not start
the recovery phase (RECOVERY04), no recovery point reached skips the recovery
phase (RECOVERY07). `src/runtime/scope.test.ts`: default and propagation of the
setting (SCOPE_RECOVERY). `src/memo.test.ts`: MEMO_RECOVERY.
`src/requirements/error-recovery/001-two-phase-matching.requirement.test.ts`:
end-to-end through `executeUffdaSource`. `src/match.test.ts`: RECOVERED03
(`isClean`).

---
id: error-recovery-005
title: Memoized outcomes are isolated by recovery setting
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#phase-isolation"
---

# Phase Isolation

## Requirement

Preconditions:

- A rule R with arguments A is invoked at position P under both recovery
  settings within one memo table (for example once inside a predicate and once
  outside it).

Expected behavior:

- The two invocations MUST resolve to distinct memo keys; neither MUST be served
  the other's outcome.
- A fresh rule invocation with recovery enabled MUST record `recovery: true` in
  its `MatchOrigin`; one with recovery disabled MUST NOT.
- Incremental rehydration MUST insert a reused entry under the recovery setting
  recorded in its origin only.

Postconditions:

- Memo eviction MUST treat entries of both settings alike.

## Test plan

`src/memo.test.ts` (MEMO_RECOVERY), `src/runtime/recovery.test.ts` (RECOVERY05,
fails if keys are shared), `src/runtime/rule.test.ts` (RULE_RECOVERY01),
`src/runtime/incremental.test.ts` (INCREMENTAL_RECOVERY).

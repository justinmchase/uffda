---
id: error-recovery-006
title: Recovery never masks a still-failing left-recursive seed
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#left-recursion"
---

# Left-Recursion Growth and Recovery

## Requirement

Preconditions:

- Matching with recovery enabled, a recover pattern R begins while the growth of
  a left-recursive head H is in progress, and R's child fails.

Expected behavior:

- If R's child failure read H's seed while that seed was still a failure
  (directly or through an outcome depending on it), R MUST fail instead of
  recovering.
- If the only still-failing seeds R's child read belong to heads whose growth
  began inside R's child, R MUST recover as usual.
- Growth MUST accept a recovered candidate like any other candidate, subject to
  the progress rule.
- The runtime MUST record seed reads while matching; it MUST NOT inspect the
  grammar to decide.

Postconditions:

- A seed's failure, being a control signal of growth, never surfaces as a
  recovery; ordinary syntax errors inside growth still recover.

## Test plan

`src/memo.test.ts` (MEMO_FAILED_SEED): seed-read recording and watch scoping.
`src/requirements/error-recovery/006-left-recursion-growth.requirement.test.ts`:
with `Main = (ope Primary sneak by any+) end` and a left-recursive
`Primary`/`Member`, `x.b` recovers at `Main` over the whole input rather than
recovering the seed inside `Primary`'s growth; `[a?b].c` recovers `?b` inside a
bracketed group within `Primary`'s growth and still grows the member access.

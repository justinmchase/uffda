---
id: error-recovery-002
title: Recovered matches are successes marked compositionally
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#recovered-matches"
---

# Recovered Matches

## Requirement

Preconditions:

- A match graph produced with recovery enabled.

Expected behavior:

- A recovery MUST be a success with `recovered: true`: an `Ok`, or a `Skip` when
  the skip pattern's success is skipped.
- Any success with a successful child marked recovered MUST itself be marked
  recovered.
- A success MUST NOT be marked recovered because of a `Fail` child, even one
  containing recovered matches.
- With recovery disabled, no match MUST be marked recovered.
- No `MatchKind` MUST be added for recovery.

Postconditions:

- A success beneath a success MUST belong to the accepted parse.

## Test plan

`src/match.test.ts`: propagation from `Ok` children and not from rejected
attempts (RECOVERED00, RECOVERED01), no marking with recovery disabled
(RECOVERED02). `src/runtime/patterns/recover.test.ts`: RECOVER02, RECOVER06.
`src/runtime/patterns/or.test.ts`: rejected recovered alternatives are `Fail`
wrappers (OR_RECOVER00).

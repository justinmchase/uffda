---
id: error-recovery-002
title: Recovered matches are Ok matches marked compositionally
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#recovered-matches"
---

# Recovered Matches

## Requirement

Preconditions:

- A match graph produced with recovery enabled.

Expected behavior:

- A recovery MUST be an `Ok` match with `recovered: true`.
- Any `Ok` with an `Ok` child marked recovered MUST itself be marked recovered.
- An `Ok` MUST NOT be marked recovered because of a `Fail` child, even one
  containing recovered matches.
- No `MatchKind` MUST be added for recovery.

Postconditions:

- An `Ok` beneath an `Ok` MUST belong to the accepted parse.

## Test plan

`src/match.test.ts`: propagation from `Ok` children and not from rejected
attempts (RECOVERED00, RECOVERED01). `src/runtime/patterns/recover.test.ts`:
RECOVER02, RECOVER06. `src/runtime/patterns/or.test.ts`: rejected recovered
alternatives are `Fail` wrappers (OR_RECOVER00).

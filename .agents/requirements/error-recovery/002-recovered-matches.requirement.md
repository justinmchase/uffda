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

`rust/src/runtime/engine_ports.rs`: propagation from successful children and not
from a clean alternative, and no recovered mark on a clean discovery result
(`engine_port_recovered_skip_and_rightmost_follow_the_accepted_match`).
`rust/src/pattern/composite_ports.rs`: RECOVER02, RECOVER06.
`rust/src/pattern/tests.rs`: a rejected recovered alternative is a `Fail` whose
only child is that alternative's success.

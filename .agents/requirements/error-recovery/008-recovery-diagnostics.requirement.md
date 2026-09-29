---
id: error-recovery-008
title: Each recovery yields one diagnostic over the source it skipped
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#diagnostics"
---

# Recovery Diagnostics

## Requirement

Preconditions:

- A match produced with recovery requested.

Expected behavior:

- Each recovery in the match's accepted parse MUST yield exactly one diagnostic,
  whose range is the source offsets of the input the recovery skipped (through
  pipeline stages, the original source offsets) and whose message is the
  match-diagnostics summary of the failure the recovery replaced (expected
  alternatives first, then the unexpected input, then the rule).
- Diagnostics MUST be in document order. A failed match MUST list its
  recoveries' diagnostics before its failure diagnostic.
- A clean success MUST yield no diagnostics.

Postconditions:

- Hosts report a result with any diagnostic as a failure, and never compile,
  resolve, or write an artifact from a module source that parsed only by
  recovering.

## Test plan

`src/match.recovery_diagnostics.test.ts` (RECOVERY_DIAGNOSTICS00–03).
`src/requirements/error-recovery/008-recovery-diagnostics.requirement.test.ts`.

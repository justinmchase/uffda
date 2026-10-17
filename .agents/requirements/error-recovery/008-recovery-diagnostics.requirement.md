---
id: error-recovery-008
title: Each recovery yields one diagnostic over the source it skipped
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#diagnostics"
---

# Recovery Diagnostics

## Requirement

Preconditions:

- A match produced by an entry point (see
  [error-recovery-001](./001-two-phase-matching.requirement.md)).

Expected behavior:

- Each recovery in the match's accepted parse MUST yield exactly one diagnostic,
  whose range is the source offsets of the input the recovery skipped (through
  pipeline stages, the original source offsets) and whose message is the
  match-diagnostics summary of the failure the recovery replaced (expected
  alternatives first, then the unexpected input, then the rule). When the host
  explains the failure (see
  [match diagnostics](../../specifications/runtime/match-diagnostics.spec.md#diagnostic-model)),
  the explanation MUST come first and MUST replace the expected alternatives.
- Diagnostics MUST be in document order. A failed match MUST list its
  recoveries' diagnostics before its failure diagnostic.
- A clean success MUST yield no diagnostics.

Postconditions:

- Hosts report a result with any diagnostic as a failure, and never compile,
  resolve, or write an artifact from a module source that parsed only by
  recovering.

## Test plan

`rust/src/runtime/engine_ports.rs`
(`engine_port_recovery_diagnostics_are_source_spans_in_document_order` for a
clean parse, document order, a failed match, an explanation, and a preceding
match; `engine_port_recovery_spans_follow_into_pipeline_stage_origins` for
source offsets through a pipeline stage that explicitly uses `into`). A later
pipeline step receives exactly one item, so a diagnostic that depends on
implicitly iterating a string is not the contract.
`src/cli/diagnostics.test.ts`.
`src/requirements/error-recovery/008-recovery-diagnostics.requirement.test.ts`.

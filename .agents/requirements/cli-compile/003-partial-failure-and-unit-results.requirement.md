---
id: cli-compile-003
title: CLI compile reports deterministic per-unit outcomes under partial failure
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#failure-and-exit-behavior"
---

# Partial Failure and Unit Result Reporting

## Requirement

Preconditions:

- At least one compilation unit succeeds and at least one unit fails.

Expected behavior:

- Compile result output MUST include deterministic per-unit success/failure
  entries.
- Successful units MUST still emit artifacts.
- Failed units MUST include deterministic failure code and message.

Postconditions:

- Batch compile workflows preserve useful outputs while surfacing complete
  diagnostics for failures.

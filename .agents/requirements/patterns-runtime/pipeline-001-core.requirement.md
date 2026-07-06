---
id: pipeline-001
title: Pipeline feeds each step from previous step output
spec_ref: ".agents/specifications/patterns/runtime/pipeline.spec.md"
---

# Pipeline Core Semantics

## Requirement

Preconditions:

- Pipeline with ordered steps is evaluated at position P.

Expected behavior:

- First step MUST evaluate against the caller-visible stream.
- Each subsequent step MUST evaluate against derived stream from prior step
  output value.
- Pipeline MUST consume outer input only through first step.

Postconditions:

- Pipeline success output MUST be the final step output.

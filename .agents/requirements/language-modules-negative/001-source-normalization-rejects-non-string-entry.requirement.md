---
id: language-modules-negative-001
title: Source-normalization module rejects non-string source entry values
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#error-and-diagnostics-requirements"
---

# Source-Normalization Negative Requirement

## Requirement

Preconditions:

- The source-normalization module entry rule receives a non-string input value.

Expected behavior:

- The module MUST return a pattern failure result.
- The module MUST NOT coerce non-string values into source text.

Postconditions:

- Source-normalization failure behavior remains deterministic for invalid entry
  values.

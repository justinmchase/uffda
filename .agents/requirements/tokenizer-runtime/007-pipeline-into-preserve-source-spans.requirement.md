---
id: tokenizer-runtime-007
title: Pipeline and into preserve source spans across layer boundaries
spec_ref: ".agents/specifications/languages/debuggability.spec.md#source-context-preservation-requirements; .agents/specifications/languages/debuggability.spec.md#provenance-mapping-requirements; .agents/specifications/patterns/runtime/pipeline.spec.md#source-provenance; .agents/specifications/patterns/runtime/into.spec.md#source-provenance"
---

# Pipeline and Into Source-Span Preservation

## Requirement

Preconditions:

- An input stream carries source provenance (`normalizationMap` and/or
  `itemSpans`) from an earlier layer such as source normalization or
  tokenization.
- A `pipeline` or `into` pattern derives a nested or successor input stream from
  a prior match value.

Expected behavior:

- Derived pipeline step streams MUST retain reconstructable original source
  spans for string and string-array stage values when the prior match and parent
  stream provide that provenance.
- Nested `into` streams MUST map nested item indices back to parent `itemSpans`
  (or a per-string `normalizationMap`) so Match `originalSpan` values remain
  authored-source offsets.
- CLI and other diagnostics consumers MUST be able to report failure locations
  from `Match.originalSpan` without heuristic token-text search.

Postconditions:

- Provenance loss at `pipeline` or `into` boundaries is treated as a contract
  regression for layered language stacks.

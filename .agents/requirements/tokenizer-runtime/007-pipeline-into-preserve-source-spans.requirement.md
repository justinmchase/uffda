---
id: tokenizer-runtime-007
title: Pipeline and into preserve source spans across layer boundaries
spec_ref: ".agents/specifications/runtime/value-provenance.spec.md#root-input; .agents/specifications/languages/debuggability.spec.md#source-context-preservation-requirements; .agents/specifications/languages/debuggability.spec.md#provenance-mapping-requirements; .agents/specifications/patterns/runtime/pipeline.spec.md#source-provenance; .agents/specifications/patterns/runtime/into.spec.md#source-provenance"
---

# Pipeline and Into Source-Span Preservation

## Requirement

Preconditions:

- An input stream's items carry origins from an earlier layer such as source
  normalization or tokenization.
- A `pipeline` or `into` pattern derives a nested or successor input stream from
  a prior match value.

Expected behavior:

- Derived pipeline step streams MUST carry the stage value unchanged, so its
  items (or, for a string, its characters) keep their origins.
- Nested `into` streams MUST iterate the current item's wrapped elements or
  characters, so Match `originalSpan` values remain authored-source offsets.
- Neither pattern MAY compute per-item span tables or recognize language value
  shapes.
- CLI and other diagnostics consumers MUST be able to report failure locations
  from `Match.originalSpan` without heuristic token-text search.

Postconditions:

- Provenance loss at `pipeline` or `into` boundaries is treated as a contract
  regression for layered language stacks.

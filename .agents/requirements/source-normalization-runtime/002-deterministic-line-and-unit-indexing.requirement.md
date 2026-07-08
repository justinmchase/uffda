---
id: source-normalization-runtime-002
title: Source normalization produces deterministic line and unit indexes covering normalized text
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#required-indexing-invariants; .agents/specifications/languages/source-normalization.spec.md#required-data-contracts"
---

# Deterministic Line and Unit Indexing

## Requirement

Preconditions:

- Source normalization is executed for a fixed source input.

Expected behavior:

- The resulting source document MUST include line-start index metadata.
- The resulting source document MUST include ordered source units that cover the
  entire normalized text without overlap or gaps.
- Repeated normalization for the same source input MUST produce equal document
  identity and indexing metadata.

Postconditions:

- Indexed source metadata remains deterministic and stable for fixed source
  input.

---
id: source-normalization-runtime-001
title: Source normalization canonicalizes line endings and preserves offset provenance
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#required-normalization-transforms; .agents/specifications/languages/source-normalization.spec.md#required-data-contracts"
---

# Canonical Line Ending Normalization

## Requirement

Preconditions:

- Source normalization is executed for raw string source input.

Expected behavior:

- Carriage return line endings (`\r`) and carriage-return + line-feed pairs
  (`\r\n`) MUST be normalized to canonical line-feed (`\n`).
- The resulting source document MUST expose normalized text and normalization
  map metadata.

Postconditions:

- The normalization map MUST preserve deterministic offset provenance from
  normalized offsets back to original source offsets.

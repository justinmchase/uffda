---
id: tokenizer-runtime-002
title: Source-normalization and tokenizer pipeline preserves reconstructable provenance
spec_ref: ".agents/specifications/languages/tokenization.spec.md#input-and-output-contracts; .agents/specifications/languages/source-normalization.spec.md#normalization-map"
---

# Source Normalization + Tokenizer Provenance Contract

## Requirement

Preconditions:

- Raw source includes mixed newline encodings requiring canonicalization.
- Source normalization executes before tokenizer in the default pipeline.

Expected behavior:

- Source normalization MUST produce canonical text and normalization map
  metadata.
- Tokenizer output for normalized text MUST remain consistent with token
  boundaries implied by source units and normalization map.

Postconditions:

- Token streams remain provenance-reconstructable against normalized source
  units for fixed input.

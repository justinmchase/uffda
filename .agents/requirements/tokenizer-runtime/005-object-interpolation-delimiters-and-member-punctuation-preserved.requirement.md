---
id: tokenizer-runtime-005
title: Object interpolation delimiters and member punctuation are preserved in token streams
spec_ref: ".agents/specifications/languages/tokenization.spec.md#interpolation-boundary-requirements"
---

# Object Interpolation Token Delimiter Preservation

## Requirement

Preconditions:

- Tokenizer language pipeline executes over source containing interpolation with
  object-like payload structure.

Expected behavior:

- Tokenization MUST preserve object interpolation delimiters (`{`, `}`) as
  distinct token boundaries.
- Tokenization MUST preserve object/member punctuation (for example `:` and `.`)
  as independently tokenizable units.

Postconditions:

- Downstream layers can reconstruct object interpolation structure without
  delimiter repair heuristics.

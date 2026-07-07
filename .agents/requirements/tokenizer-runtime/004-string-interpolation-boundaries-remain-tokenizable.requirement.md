---
id: tokenizer-runtime-004
title: String interpolation boundaries remain independently tokenizable
spec_ref: ".agents/specifications/languages/tokenization.spec.md#interpolation-boundary-requirements"
---

# String Interpolation Token Boundaries

## Requirement

Preconditions:

- Tokenizer language pipeline executes over source containing quoted strings and
  interpolation markers.

Expected behavior:

- Tokenization MUST emit quote and interpolation delimiters as distinct token
  boundaries.
- Tokenization MUST NOT collapse entire quoted interpolation regions into one
  opaque token.

Postconditions:

- Downstream expression and pattern layers can deterministically parse string
  interpolation structure from tokenizer output.

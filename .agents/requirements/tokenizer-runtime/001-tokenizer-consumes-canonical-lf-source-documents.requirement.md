---
id: tokenizer-runtime-001
title: Tokenizer consumes normalized source-document input and recognizes canonical LF newlines
spec_ref: ".agents/specifications/languages/tokenization.spec.md#layer-position-and-integration; .agents/specifications/languages/tokenization.spec.md#required-tokenizer-module-shape"
---

# Tokenizer Canonical LF Input Contract

## Requirement

Preconditions:

- Source normalization and indexing produce canonical source text with `\n`
  newlines.
- Tokenizer is executed against normalized source-document iterable input.

Expected behavior:

- Tokenizer MUST tokenize canonical `\n` as newline tokens.
- Tokenizer MUST emit deterministic token streams for fixed normalized input.

Postconditions:

- Newline token behavior remains aligned with source-normalization ownership of
  newline canonicalization.

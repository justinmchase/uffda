---
id: tokenizer-runtime-010
title: Std semantic text helpers omit comments and optional whitespace
spec_ref: ".agents/specifications/languages/tokenization.spec.md#semantic-token-text-helpers-bootstrap-precursors"
---

# Semantic Token Text Std Helpers

## Requirement

Preconditions:

- The runtime std globals include `semantic_texts` and
  `semantic_no_whitespace_texts`.
- Structured token values expose `kind` and `text` only.

Expected behavior:

- `semantic_texts` MUST omit tokens whose `kind` is `"comment"` and MUST retain
  whitespace and newline texts.
- `semantic_no_whitespace_texts` MUST retain only `"word"` and `"punctuation"`
  texts.
- Helpers MUST NOT read Match spans.

Error behavior:

- Non-array inputs MUST throw TypeError.
- Entries without a string `text` MUST throw TypeError.

---
id: tokenizer-runtime-010
title: Semantic token text funcs omit comments and optional whitespace
spec_ref: ".agents/specifications/languages/tokenization.spec.md#semantic-token-text-helpers"
---

# Semantic Token Text Funcs

## Requirement

Preconditions:

- `tokenizer.lang.uff` declares a module-local `semantic_texts` func.
- `tokenizer/mod.uff` declares a module-local `semantic_no_whitespace_texts`
  func.
- Structured token values expose `kind` and `text` only.

Expected behavior:

- `semantic_texts` MUST omit tokens whose `kind` is `"comment"` and MUST retain
  whitespace and newline texts.
- `semantic_no_whitespace_texts` MUST retain only `"word"` and `"punctuation"`
  texts.
- Funcs MUST NOT read Match spans.

Error behavior:

- Non-array inputs MUST fail the func's argument pattern match.
- Entries without a string `text` field MUST fail argument pattern matching.

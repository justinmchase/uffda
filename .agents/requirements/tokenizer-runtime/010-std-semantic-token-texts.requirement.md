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
  func, and exports the `TokenizerNoWhitespace` view that projects it and the
  comment-preserving `TokenizerNoWhitespaceWithComments` view.
- Structured token values expose `kind` and `text` only.

Expected behavior:

- `semantic_texts` MUST omit tokens whose `kind` is `"comment"` and MUST retain
  whitespace and newline texts.
- `semantic_no_whitespace_texts` MUST retain only `"word"` and `"punctuation"`
  texts. Whitespace and newlines inside a quoted string are string content
  (`"punctuation"` tokens), so they MUST be retained.
- `TokenizerNoWhitespaceWithComments` MUST produce the same texts as
  `semantic_no_whitespace_texts`, in the same order, except that each
  `"comment"` token MUST also be retained, at its source position, as the
  tokenizer's own `{ kind: "comment", text }` value rather than as its text.
- A comment token that follows a word or punctuation token on the same line MUST
  be preceded by exactly one `{ kind: "lineEnd" }` item. A comment on its own
  line MUST NOT be.
- Funcs MUST NOT read Match spans.

Error behavior:

- Non-array inputs MUST fail the func's argument pattern match.
- Entries without a string `text` field MUST fail argument pattern matching.

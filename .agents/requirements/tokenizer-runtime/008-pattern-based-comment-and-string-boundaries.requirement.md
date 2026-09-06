---
id: tokenizer-runtime-008
title: Comment and string boundaries are tokenizer patterns
spec_ref: ".agents/specifications/languages/tokenization.spec.md#structured-tokens-and-trivia; .agents/specifications/languages/tokenization.spec.md#comment-trivia; .agents/specifications/languages/tokenization.spec.md#delivery-milestone-tokenizer-trivia-and-source-spans"
---

# Pattern-Based Comment and String Boundaries

## Requirement

Preconditions:

- The tokenizer module defines comment and quoted-string recognition rules.

Expected behavior:

- Line comments MUST be recognized by a tokenizer pattern rule that projects a
  single Comment trivia token spanning `#` through end-of-line (excluding the
  newline).
- Quoted-string regions MUST be recognized by tokenizer pattern rules that keep
  `"`, escapes, and interior punctuation/words as independent tokens so
  interpolation delimiters remain visible.
- A `#` inside a quoted-string region MUST remain a punctuation token, not
  Comment trivia.
- Tokenizer MUST NOT rely on a host-language quote/comment state machine to
  rewrite token streams after lexing.

Postconditions:

- Comment and string boundary behavior is expressed in the tokenizer grammar and
  remains reconstructable from Match results.

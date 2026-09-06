---
id: tokenizer-runtime-006
title: Hash line comments are quote-aware non-semantic trivia
spec_ref: ".agents/specifications/languages/tokenization.spec.md#comment-trivia"
---

# Hash Line Comment Trivia

## Requirement

Preconditions:

- The tokenizer receives normalized source containing `#` outside or inside a
  quoted string.

Expected behavior:

- Outside quoted strings, `#` and all following source units through the end of
  that line MUST be absent from semantic token output.
- Outside quoted strings, `#` line comments MUST be projected as Comment trivia
  tokens by tokenizer patterns (not by a post-lex host rewrite).
- A trailing line comment MUST NOT remove semantic tokens before `#`.
- A `#` inside a quoted string MUST remain in semantic token output.
- Comment recognition MUST also work when comment text begins with a digit or
  punctuation.

Postconditions:

- Downstream language parsers observe the same semantic token sequence as if
  each comment were absent.

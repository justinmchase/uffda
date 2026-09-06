---
id: tokenizer-runtime-009
title: Quoted-string escapes consume one semantic follower
spec_ref: ".agents/specifications/languages/tokenization.spec.md#escape-sequences-in-quoted-strings; .agents/specifications/languages/pattern-syntax/string-literals.spec.md#tokenizer-escape-followers"
---

# Quoted String Escape Followers

## Requirement

Preconditions:

- Tokenizer emits structured tokens for quoted string interiors.
- Downstream PatternLang uses `TokenizerNoWhitespace` semantic texts.

Expected behavior:

- After `\`, the tokenizer MUST consume exactly one follower character.
- The follower MUST be emitted as a semantic (non-trivia) token text so
  sequences such as `\t`, `\n`, `\r`, `\\`, and `\"` survive
  `toSemanticNoWhitespaceTexts`.

Postconditions:

- Pattern string escape rules can match `\` plus a single character token.

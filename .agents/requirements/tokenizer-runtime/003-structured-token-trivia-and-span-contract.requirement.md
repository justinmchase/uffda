---
id: tokenizer-runtime-003
title: Structured tokens preserve trivia and source spans
spec_ref: ".agents/specifications/languages/tokenization.spec.md#structured-tokens-and-trivia; .agents/specifications/languages/tokenization.spec.md#delivery-milestone-tokenizer-trivia-and-source-spans"
---

# Structured Token Trivia and Span Contract

## Requirement

Preconditions:

- Tokenizer receives a normalized `SourceDocument`.

Expected behavior:

- The tokenizer MUST expose structured token and trivia data with token kind,
  text, normalized span, and original span.
- Comments and whitespace MUST remain available as trivia while being omitted
  from the semantic stream consumed by existing parsers.
- Trivia attachment and ordering MUST be deterministic.

Postconditions:

- Tooling can inspect or reproduce authored comments and whitespace without
  changing existing parser-facing token semantics.

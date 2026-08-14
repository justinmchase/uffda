---
id: tokenizer-runtime-003
title: Match results carry token trivia and source spans
spec_ref: ".agents/specifications/languages/tokenization.spec.md#structured-tokens-and-trivia; .agents/specifications/languages/tokenization.spec.md#delivery-milestone-tokenizer-trivia-and-source-spans; .agents/specifications/languages/debuggability.spec.md#source-context-preservation-requirements"
---

# Match-Owned Token Trivia and Span Contract

## Requirement

Preconditions:

- Tokenizer receives a normalized `SourceDocument` (via TokenizerLang or an
  iterable document with a normalization map).

Expected behavior:

- Token rule projections MUST contain only token kind and text.
- Every Match result MUST include `normalizedSpan` and `originalSpan`. Original
  spans MUST map through the source normalization map when the matched stream
  carries that provenance.
- Comments and whitespace MUST remain available as trivia while being omitted
  from the semantic stream consumed by existing parsers.
- Trivia attachment and ordering MUST be deterministic.

Postconditions:

- Tooling can inspect authored comments, whitespace, and exact source locations
  from Match results without changing parser-facing token semantics.

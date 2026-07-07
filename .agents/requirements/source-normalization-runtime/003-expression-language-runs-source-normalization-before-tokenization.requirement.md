---
id: source-normalization-runtime-003
title: Expression language pipeline runs source normalization and indexing before tokenization
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#layer-position-and-integration; .agents/specifications/languages/tokenization.spec.md"
---

# Source Normalization Precedes Tokenization

## Requirement

Preconditions:

- The expression language stack is composed using the default language-layer
  pipeline.

Expected behavior:

- Expression language pipeline order MUST evaluate `SourceNormalizationAndIndex`
  before `Tokenizer`.
- `Tokenizer` input MUST originate from normalized indexed source output.

Postconditions:

- Default expression-language composition preserves deterministic pre-tokenizer
  source normalization behavior.

---
id: language-modules-negative-002
title: Tokenizer module rejects non-tokenizable input items
spec_ref: ".agents/specifications/languages/tokenization.spec.md#error-and-negative-behavior-requirements"
---

# Tokenizer Negative Requirement

## Requirement

Preconditions:

- The tokenizer module receives at least one input item that cannot satisfy
  tokenizer token rules.

Expected behavior:

- The module MUST return a type error result when token rules receive
  incompatible value types.
- The module MUST NOT coerce invalid items into token strings.

Postconditions:

- Invalid tokenizer input remains diagnosable by deterministic error outcome.

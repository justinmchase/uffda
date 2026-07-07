---
id: tokenizer-runtime-003
title: Tokenizer fails non-tokenizable input without implicit coercion
spec_ref: ".agents/specifications/languages/tokenization.spec.md#error-and-negative-behavior-requirements"
---

# Tokenizer Negative Input Behavior

## Requirement

Preconditions:

- Tokenizer receives input values that do not satisfy token pattern contracts.

Expected behavior:

- Tokenizer MUST return a type error outcome when a token rule receives a value
  of incompatible type.
- Tokenizer MUST NOT silently coerce non-tokenizable values into token strings.

Postconditions:

- Error semantics remain deterministic for invalid tokenizer input.

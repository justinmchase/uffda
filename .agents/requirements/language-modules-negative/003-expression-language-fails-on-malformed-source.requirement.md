---
id: language-modules-negative-003
title: Expression language fails deterministically on malformed source
spec_ref: ".agents/specifications/languages/expression-layer.spec.md#integration-requirements"
---

# Expression Language Negative Requirement

## Requirement

Preconditions:

- Expression-language entry receives malformed source that does not satisfy
  expression grammar contracts.

Expected behavior:

- The language entry MUST return a pattern failure result.
- The language entry MUST NOT return successful expression values for malformed
  input.

Postconditions:

- Malformed expression input remains diagnosable through deterministic failure
  outcomes.

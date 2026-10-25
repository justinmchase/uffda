---
id: pattern-language-syntax-004
title: Line breaks between pattern tokens parse the same as spaces
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#canonical-form"
---

# Line Breaks Are Not Semantic

## Requirement

Preconditions:

- A pattern body is parsed by `PatternLang`.

Expected behavior:

- A line break MUST parse the same as a space between prefix operators and their
  operands, around reference arguments, around pipeline operators, and inside
  multiline alternatives and keyed forms.

Postconditions:

- Tests: `src/lang_tests/pattern.rs`.

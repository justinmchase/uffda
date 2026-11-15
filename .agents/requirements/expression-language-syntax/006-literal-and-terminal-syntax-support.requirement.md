---
id: expression-language-syntax-006
title: Expression language supports deterministic literal and terminal syntax forms
spec_ref: ".agents/specifications/languages/expression-syntax/literals-and-terminals.spec.md#syntax-requirements; .agents/specifications/expressions/symbol.spec.md#behavioral-expectations"
---

# Literal and Terminal Syntax Support

## Requirement

Preconditions:

- Expression syntax includes terminal literal and reference forms.

Expected behavior:

- Terminal syntax MUST include numeric, boolean, and nullish literal forms,
  identifier/reference forms, and `@Identifier` symbol literals.
- `@Identifier` MUST project a symbol expression whose name is that identifier.
  `@func` MUST project a symbol named `func`, not a reference and not an
  identifier escape.
- A reserved word MUST still be rejected as an identifier. `func` MUST NOT be
  accepted as a declaration name, and `@func` MUST NOT be accepted as one
  either.
- Literal and reference syntax forms MUST be lexically distinguishable for
  deterministic parsing.

Valid syntax examples:

- `123`
- `0`
- `42`
- `true`
- `false`
- `null`
- `undefined`
- `name`
- `userName1`
- `@name`
- `@func`

Invalid syntax examples:

- ``
- `12abc`
- `@`
- `@1`

Postconditions:

- Literal and terminal parsing remains deterministic and unambiguous for fixed
  tokenizer output.

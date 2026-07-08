---
id: expression-language-syntax-006
title: Expression language supports deterministic literal and terminal syntax forms
spec_ref: ".agents/specifications/languages/expression-syntax/literals-and-terminals.spec.md#syntax-requirements"
---

# Literal and Terminal Syntax Support

## Requirement

Preconditions:

- Expression syntax includes terminal literal and reference forms.

Expected behavior:

- Terminal syntax MUST include numeric, boolean, and nullish literal forms, and
  identifier/reference forms.
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

Invalid syntax examples:

- ``
- `12abc`
- `@name`

Postconditions:

- Literal and terminal parsing remains deterministic and unambiguous for fixed
  tokenizer output.

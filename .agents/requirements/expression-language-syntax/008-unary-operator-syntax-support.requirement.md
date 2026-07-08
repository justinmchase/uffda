---
id: expression-language-syntax-008
title: Expression language supports unambiguous unary operator syntax with canonical normalization
spec_ref: ".agents/specifications/languages/expression-syntax/unary-operators.spec.md#syntax-requirements"
---

# Unary Operator Syntax Support

## Requirement

Preconditions:

- Expression syntax includes unary expression forms.

Expected behavior:

- Unary forms MUST bind to exactly one operand expression.
- Unary forms MUST remain unambiguous with binary forms.
- Unary surface forms MUST normalize to canonical operator-head forms.

Valid syntax examples:

- `not value`
- `not (value)`
- `(not value)`

Invalid syntax examples:

- `not`
- `(not)`
- `value not`

Postconditions:

- Unary parsing and canonicalization remain deterministic and non-conflicting.

---
id: expression-language-syntax-007
title: Expression language supports invocation sequence syntax with balanced delimiters
spec_ref: ".agents/specifications/languages/expression-syntax/grouping-and-sequence.spec.md#syntax-requirements"
---

# Grouping and Sequence Syntax Support

## Requirement

Preconditions:

- Expression syntax includes parenthesized invocation sequence forms.

Expected behavior:

- Parenthesized sequence forms MUST use balanced `(` and `)` delimiters.
- Parenthesized forms MUST be interpreted as invocation sequence forms in MVP.
- Sequence forms MUST remain unambiguous with other delimiter constructs.

Valid syntax examples:

- `(f)`
- `(f x)`
- `(f x y)`
- `((getFactory) x)`

Invalid syntax examples:

- `(123`
- `123)`
- `()`

Postconditions:

- Parenthesized sequence parsing remains deterministic and compatible with other
  expression feature forms.

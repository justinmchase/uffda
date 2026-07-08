---
id: expression-language-syntax-003
title: Expression language supports explicit string and object interpolation syntax
spec_ref: ".agents/specifications/languages/expression-syntax/string-and-interpolation.spec.md#syntax-requirements"
---

# String and Object Interpolation Syntax Support

## Requirement

Preconditions:

- Expression syntax includes quoted string forms and interpolation boundaries.

Expected behavior:

- The language MUST support quoted strings and explicit interpolation forms
  using delimiter boundaries.
- The language MUST support escaped literal opening curly characters in string
  content using `\{`.
- Interpolation syntax MUST support object-like payload structures for
  meta-programming use cases.

Valid syntax examples:

- `"hello"`
- `"hello {name}"`
- `"{user.name}"`
- `"\{{example}}"`
- `"{ {name: user.name} }"`

Invalid syntax examples:

- `"unterminated`
- `"hello {name"`
- `"hello }"`
- `"{{example}}"`
- `` `${name}` ``

Postconditions:

- String and object interpolation forms are explicitly representable without
  introducing template-literal sugar ambiguity.

---
id: expression-language-syntax-009
title: Expression language supports explicit member access syntax
spec_ref: ".agents/specifications/languages/expression-syntax/member-access.spec.md#syntax-requirements"
---

# Member Access Syntax Support

## Requirement

Preconditions:

- Expression syntax includes property projection forms.

Expected behavior:

- Member access MUST use explicit postfix dot syntax.
- Member access MUST project a named property from an evaluated base
  expression.
- Member access MUST remain unambiguous with spread syntax.

Valid syntax examples:

- `user.name`
- `config.theme.primary`
- `data.items.length`

Invalid syntax examples:

- `.name`
- `user.`
- `user..name`

Postconditions:

- Member access syntax remains deterministic, postfix, and codegen-friendly.

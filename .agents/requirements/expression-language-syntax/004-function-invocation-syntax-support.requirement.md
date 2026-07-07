---
id: expression-language-syntax-004
title: Expression language supports explicit low-sugar function invocation syntax
spec_ref: ".agents/specifications/languages/expression-syntax/function-invocation.spec.md#syntax-requirements"
---

# Function Invocation Syntax Support

## Requirement

Preconditions:

- Expression syntax includes invocation expressions.

Expected behavior:

- Invocation syntax MUST use explicit parenthesized low-sugar forms.
- Invocation syntax MUST support zero or more invocation arguments.

Valid syntax examples:

- `(f)`
- `(f x)`
- `(f x y)`
- `((getFactory) x)`

Invalid syntax examples:

- `f(x)`
- `(f, x)`
- `(f`
- `f x)`

Postconditions:

- Invocation syntax remains explicit, deterministic, and codegen-friendly.

---
id: expression-language-syntax-012
title: Expression language supports explicit defaulting and coalescing syntax in MVP
spec_ref: ".agents/specifications/languages/expression-syntax/defaulting-and-coalescing.spec.md#syntax-requirements"
---

# Defaulting and Coalescing Syntax Support

## Requirement

Preconditions:

- Expression projections require deterministic fallback/default behavior.

Expected behavior:

- Defaulting/coalescing behavior SHOULD be represented through explicit
  invocation/operator-head forms in MVP.
- MVP MUST NOT require infix null-coalescing precedence syntax.
- Coalescing forms MUST preserve deterministic left-to-right evaluation for
  fixed input and visible bindings.

Valid syntax examples:

- `(coalesce a b)`
- `(coalesce user.name "unknown")`
- `(coalesce (match x p) fallback)`

Invalid syntax examples:

- `a ?? b`
- `a ?: b`

Postconditions:

- Defaulting behavior is explicit and deterministic without introducing infix
  precedence ambiguity.

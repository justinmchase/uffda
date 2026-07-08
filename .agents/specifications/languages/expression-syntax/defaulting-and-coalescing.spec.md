# Defaulting and coalescing syntax

This chapter defines explicit defaulting/coalescing forms for MVP expression
syntax.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Defaulting/coalescing behavior SHOULD be represented through explicit
  invocation/operator-head forms in MVP.
- MVP MUST NOT require infix null-coalescing precedence syntax for defaulting
  behavior.
- Coalescing forms MUST preserve deterministic left-to-right evaluation for
  fixed input and visible bindings.

## Valid syntax examples

- `(coalesce a b)`
- `(coalesce user.name "unknown")`
- `(coalesce (match x p) fallback)`

## Invalid syntax examples

- `a ?? b` (infix coalescing syntax deferred from MVP)
- `a ?: b` (ternary-like shorthand not supported in MVP)

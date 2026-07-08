# Binary operator syntax

This chapter defines binary operator policy for the expression layer.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Binary operation semantics MAY exist in the expression layer through explicit
  invocation/operator-head forms.
- Infix precedence-based binary syntax is deferred from MVP.
- MVP expression parsing MUST NOT require reader-visible precedence resolution
  for binary infix chains.
- If infix binary syntax is introduced later, it MUST define deterministic,
  non-conflicting precedence and associativity rules and canonicalization.

## Explicit-form examples

- `(and a b)`
- `(or a b)`
- `(add x y)`
- `(coalesce x y)`

## Valid syntax examples

- `(and a b)`
- `(or a b)`
- `(add x y)`
- `(coalesce x y)`

## Invalid syntax examples

- `a and b` (infix precedence form deferred from MVP)
- `x + y` (infix precedence form deferred from MVP)
- `x and (y or z)` (grouping/precedence form deferred from MVP)

# Grouping and sequence syntax

This chapter defines parenthesized sequence forms used by invocation syntax.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Parenthesized sequence forms MUST use balanced `(` and `)` delimiters.
- In MVP, parenthesized forms MUST be interpreted as invocation sequence forms,
  not as standalone grouping-only forms.
- Sequence forms MUST remain unambiguous with other delimiter constructs.

## Valid syntax examples

- `(f)`
- `(f x)`
- `(f x y)`
- `((getFactory) x)`

## Invalid syntax examples

- `(123` (missing closing delimiter)
- `123)` (missing opening delimiter)
- `()` (empty sequence when at least one inner expression is required)

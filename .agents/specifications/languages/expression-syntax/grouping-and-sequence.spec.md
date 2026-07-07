# Grouping and sequence syntax

This chapter defines parenthesized grouping and sequence expression forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Grouping syntax MUST use balanced `(` and `)` delimiters.
- Sequence/grouping forms MUST NOT conflict with function-like or alternate
  delimiter constructs in this layer.

## Valid syntax examples

- `(123)`
- `(name)`
- `("text")`

## Invalid syntax examples

- `(123` (missing closing delimiter)
- `123)` (missing opening delimiter)
- `()` (empty sequence when at least one inner expression is required)

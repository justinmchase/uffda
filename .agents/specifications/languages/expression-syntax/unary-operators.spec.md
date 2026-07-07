# Unary operator syntax

This chapter defines unary expression forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Unary prefix forms (for example `not`) MUST be syntactically distinct from
  references.
- Unary forms MUST bind to exactly one operand expression.
- Unary forms MAY be prefix or postfix, but MUST remain unambiguous with binary
  forms.
- Unary forms MUST avoid ambiguity with binary operator forms.
- Unary surface forms MUST normalize to canonical operator-head expression
  forms.
- Canonical unary operator form SHOULD be parenthesized operator-head syntax
  such as `(not x)`.

## Valid syntax examples

- `not value`
- `not (value)`
- `(not value)`

## Invalid syntax examples

- `not` (missing operand)
- `(not)` (operator form with no operand expression)
- `value not` (invalid unary placement)

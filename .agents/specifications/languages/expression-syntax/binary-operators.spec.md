# Binary operator syntax

This chapter defines binary infix expression forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Binary operators MUST have explicit left and right operands.
- Binary operator tokens MUST be reserved and MUST NOT be parsed as ordinary
  references in binary positions.
- `+` and `*` MUST be treated as binary infix operators in this expression
  language layer.
- Binary precedence/associativity rules MUST be deterministic and
  non-conflicting for fixed token streams.
- Binary infix surface forms MUST normalize to canonical operator-head forms for
  downstream compilation.

## Canonicalization examples

- `a and b` -> `(and a b)`
- `x + y` -> `(+ x y)`
- `x * y` -> `(* x y)`

## Valid syntax examples

- `a and b`
- `a or b`
- `x + y`
- `x * y`
- `x and (y or z)`

## Invalid syntax examples

- `and a` (missing left operand)
- `a and` (missing right operand)
- `x +` (missing right operand)
- `* y` (missing left operand)
- `a and or b` (invalid operator sequence)

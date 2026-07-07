# Boolean expression

This chapter defines the contract for boolean literal expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

The boolean expression represents a literal `true` or `false` value.

## Behavioral expectations

- A boolean expression MUST evaluate to its declared boolean value.
- Evaluation of a boolean expression MUST NOT depend on runtime scope values.

## Error conditions

- The boolean expression itself does not introduce new evaluation errors.

## Composition intent

- Boolean expressions SHOULD be used as explicit truthy/falsy operands in unary
  and binary expression composition.

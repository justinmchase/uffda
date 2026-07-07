# Not expression

This chapter defines the contract for unary logical negation.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

The `not` expression negates the truthiness of a child expression result.

## Behavioral expectations

- A not expression MUST evaluate its child expression first.
- A not expression MUST apply JavaScript truthiness negation (`!`) to the child
  result.

## Error conditions

- Child-expression errors MUST propagate unchanged.

## Composition intent

- Not expressions SHOULD be used for guard-style boolean projection.

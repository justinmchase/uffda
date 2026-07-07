# Binary expression

This chapter defines the contract for binary logical expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Binary expressions compose two child expressions under a declared binary
operation.

## Behavioral expectations

- A binary expression MUST evaluate left and right child expressions.
- Supported operations MUST include logical `and` and logical `or`.
- The operation result MUST follow JavaScript logical operator semantics for the
  evaluated child values.

## Error conditions

- Child-expression exceptions MUST propagate unchanged.
- Unknown binary operations MUST throw an evaluation exception.

## Composition intent

- Binary expressions SHOULD be used for truthiness-based conditional composition
  in projection logic.

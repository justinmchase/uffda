# Array element initializer

This chapter defines the contract for array element initializer expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Array element initializers contribute one evaluated expression value to an array
result.

## Behavioral expectations

- An array-element initializer MUST evaluate its child expression.
- The evaluated value MUST be appended as one element in the resulting array.

## Error conditions

- Child-expression errors MUST propagate unchanged.

## Composition intent

- Array-element initializers SHOULD be used for explicit positional construction
  in array expressions.

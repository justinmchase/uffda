# Array spread initializer

This chapter defines the contract for array spread initializer expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Array spread initializers expand an evaluated child value into multiple array
elements.

## Behavioral expectations

- An array-spread initializer MUST evaluate its child expression.
- The evaluated child value MUST be spread into the target array according to
  runtime spread semantics.

## Error conditions

- Child-expression errors MUST propagate unchanged.
- Non-spreadable child values MUST report runtime spread errors according to the
  host runtime behavior.

## Composition intent

- Array-spread initializers SHOULD be used for compositional list construction
  from previously evaluated array-like values.

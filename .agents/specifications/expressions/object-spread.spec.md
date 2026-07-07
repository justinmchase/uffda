# Object spread initializer

This chapter defines the contract for object spread initializer expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Object spread initializers merge properties from an evaluated child value into
an object expression result.

## Behavioral expectations

- An object-spread initializer MUST evaluate its child expression.
- The evaluated child value MUST be spread into the target object according to
  runtime spread semantics.

## Error conditions

- Child-expression errors MUST propagate unchanged.
- Non-spreadable child values MUST report runtime spread errors according to the
  host runtime behavior.

## Composition intent

- Object-spread initializers SHOULD be used for object composition and override
  layering.

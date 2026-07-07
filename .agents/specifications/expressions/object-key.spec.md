# Object key initializer

This chapter defines the contract for named object key initializer expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Object key initializers assign a single named property in an object expression.

## Behavioral expectations

- An object-key initializer MUST evaluate its child expression.
- The resulting value MUST be assigned to the declared property name.

## Error conditions

- Child-expression errors MUST propagate unchanged.

## Composition intent

- Object-key initializers SHOULD be used for explicit, stable property mapping.

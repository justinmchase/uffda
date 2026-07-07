# Object expression

This chapter defines the contract for object construction expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Object expressions construct key-value objects from object initializer entries.

## Behavioral expectations

- An object expression MUST evaluate initializer entries in declaration order.
- Object-key initializers MUST assign one named property.
- Object-spread initializers MUST merge properties from an evaluated object-like
  value according to runtime spread semantics.
- Later assignments MAY override earlier properties when names collide.

## Error conditions

- Unknown initializer kinds MUST throw an evaluation exception.
- Child-expression exceptions MUST propagate unchanged.

## Composition intent

- Object expressions SHOULD be used to construct structured projection values
  from matches and nested expressions.

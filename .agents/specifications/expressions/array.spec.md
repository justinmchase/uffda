# Array expression

This chapter defines the contract for array construction expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Array expressions construct ordered list values from array initializer entries.

## Behavioral expectations

- An array expression MUST evaluate initializer entries in declaration order.
- Array-element initializers MUST append one evaluated value.
- Array-spread initializers MUST spread evaluated iterable entries into the
  resulting array according to runtime spread semantics.

## Error conditions

- Unknown initializer kinds MUST throw an evaluation exception.
- Child-expression exceptions MUST propagate unchanged.

## Composition intent

- Array expressions SHOULD be used to build ordered argument or projection
  structures from match-derived values.

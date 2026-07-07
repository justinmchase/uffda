# Member expression

This chapter defines the contract for property-member access expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Member expressions project a named property from an evaluated base expression.

## Behavioral expectations

- A member expression MUST evaluate its base expression.
- A member expression MUST read the declared property name from the base value
  according to runtime property-access semantics.

## Error conditions

- Child-expression errors MUST propagate unchanged.
- Invalid property-access targets MAY produce runtime access errors according to
  host runtime semantics.

## Composition intent

- Member expressions SHOULD be used for structured value projection from objects
  produced by earlier expressions.

# Object computed-key initializer

This chapter defines the contract for computed (expression-valued) object key
initializer expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Object computed-key initializers assign a single property in an object
expression whose property key is itself the result of evaluating an expression,
rather than a bare identifier.

## Behavioral expectations

- An object-computed-key initializer MUST evaluate its key expression.
- An object-computed-key initializer MUST evaluate its value expression.
- The resulting key value MUST be assigned as the property key, and the
  resulting value MUST be assigned as that property's value.
- Key evaluation order relative to value evaluation is unspecified beyond the
  requirement that both complete before assignment.

## Error conditions

- A resolved key value that is not a `string`, `number`, or `symbol` MUST throw
  an evaluation exception.
- Child-expression errors (from either the key expression or the value
  expression) MUST propagate unchanged.

## Composition intent

- Object computed-key initializers SHOULD be used when a property key is not
  known statically, for example a well-known or interned symbol obtained from
  another expression (such as a `symbol` lookup), or a dynamically computed
  string/number key.

# Value expression

This chapter defines the contract for serializable value expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

The value expression embeds a serializable literal value into an expression
tree.

## Behavioral expectations

- A value expression MUST evaluate to its declared serializable value.
- Evaluation of a value expression MUST NOT depend on runtime scope values.

## Error conditions

- The value expression itself does not introduce new evaluation errors.

## Composition intent

- Value expressions SHOULD be used for literal data projection and deterministic
  expression fixtures.

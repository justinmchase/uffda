# Number expression

This chapter defines the contract for numeric literal expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

The number expression represents a literal numeric value.

## Behavioral expectations

- A number expression MUST evaluate to its declared numeric value.
- Evaluation of a number expression MUST NOT depend on runtime scope values.

## Error conditions

- The number expression itself does not introduce new evaluation errors.

## Composition intent

- Number expressions SHOULD be usable wherever expressions expect primitive
  value operands.

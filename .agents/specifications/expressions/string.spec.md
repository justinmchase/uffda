# String expression

This chapter defines the contract for string-construction expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

String expressions construct a string from literal segments and embedded
expression values.

## Interpolation semantics

- String expressions MUST support interpolation through embedded expression
  segments.
- Interpolation MUST be explicit in the expression tree as ordered string and
  expression segments rather than implicit host-language template evaluation.

## Behavioral expectations

- A string expression MUST evaluate segments in declaration order.
- Literal string segments MUST be appended as-is.
- Embedded expression segments MUST be evaluated and converted to string
  representation.
- Interpolated results MUST preserve segment ordering from the source expression
  tree.

## Error conditions

- Child-expression exceptions MUST propagate unchanged.

## Composition intent

- String expressions SHOULD be used for interpolation-style value projection
  while keeping interpolation semantics explicit in expression trees.

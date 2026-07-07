# Reference expression

This chapter defines the contract for expression name resolution.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Reference expressions resolve a name from expression-visible runtime context.

## Behavioral expectations

- The reserved name `_` MUST resolve to the current match value.
- For non-reserved names, resolution MUST check local match variables before
  configured runtime capabilities.
- The runtime capability set MAY include standard-library values and additional
  explicitly injected bindings.
- If a name is unresolved in both local variables and runtime capabilities,
  evaluation MUST throw a reference exception.

## Error conditions

- Unresolved names MUST throw a reference exception.

## Composition intent

- Reference expressions SHOULD be used for explicit dependency projection from
  scope and configured runtime capabilities.

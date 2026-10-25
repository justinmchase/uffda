# Native expression

This chapter defines the contract for host-language native expression forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Native expressions provide an escape hatch for host-language projection logic
when expression-tree forms are insufficient.

This chapter's native JavaScript expression form describes the retired TypeScript
runtime. The production Rust runtime MUST reject native-JavaScript expression
ASTs and MUST NOT embed a JavaScript engine. Invocation of Rust-native globals
remains in scope and follows the ordinary invocation and provenance contracts.

## Behavioral expectations

- A native expression MUST invoke its declared host-language function.
- Native invocation MUST pass expression-visible variables, resolved runtime
  capabilities, and current match context.
- Native expression return values MUST become the expression evaluation result.

## Error conditions

- Exceptions thrown by native expression functions MUST propagate as expression
  exceptions unless wrapped by a stricter runtime policy.

## Composition intent

- Native expressions SHOULD be used sparingly and only when declarative
  expression forms cannot represent the desired projection.

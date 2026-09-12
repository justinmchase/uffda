# Invocation expression

This chapter defines the contract for callable invocation expressions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Invocation expressions evaluate a target expression and arguments, then invoke
the resulting callable value.

## Behavioral expectations

- An invocation expression MUST evaluate its target expression.
- An invocation expression MUST evaluate argument expressions in declaration
  order.
- Invocation MUST call the evaluated target with evaluated argument values.
- Local-scope references used by the target expression SHOULD resolve before
  globals according to reference-expression behavior.

## Match access

Callables never receive an implicitly injected match. Expressions that need the
current successful match (for example span leaf offsets) use the reserved `this`
reference (see the [Reference expression specification](./reference.spec.md))
and pass it as an ordinary argument, or read fields from it directly via member
expressions (for example `this.normalizedSpan.start`).

## Error conditions

- Target or argument child-expression exceptions MUST propagate unchanged.
- If the evaluated target is not callable, invocation MUST throw an evaluation
  exception.

## Composition intent

- Invocation expressions SHOULD be used to call runtime-provided functions,
  lambda expressions, and explicit host interop callables.

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

## Match-aware invocation

Some std callables need the current successful match (for example span leaf
offsets) without authors threading Match values through projections.

- The runtime MUST recognize match-aware callables via an explicit host
  allowlist marker on the function value (not via special-case name tables in
  language modules).
- When the evaluated target is match-aware, invocation MUST call it as
  `fn(match, ...evaluatedArgs)` where `match` is the current successful
  `MatchOk`.
- When the evaluated target is not match-aware, invocation MUST call it as
  `fn(...evaluatedArgs)` with no injected match.
- Authors MUST write match-aware calls without supplying the match argument
  themselves (for example `(match_leaf_offset "start")`).

## Error conditions

- Target or argument child-expression exceptions MUST propagate unchanged.
- If the evaluated target is not callable, invocation MUST throw an evaluation
  exception.

## Composition intent

- Invocation expressions SHOULD be used to call runtime-provided functions,
  lambda expressions, and explicit host interop callables.

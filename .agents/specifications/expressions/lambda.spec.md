# Lambda expression

This chapter defines the contract for lambda expression construction and use.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Lambda expressions create callable values that match invocation arguments
against a lambda pattern and then project a result expression.

## Behavioral expectations

- Evaluating a lambda expression MUST produce a callable value.
- Invoking the produced callable MUST match invocation arguments against the
  lambda pattern using runtime pattern semantics.
- On successful argument-pattern match, invocation MUST evaluate the lambda body
  expression in the resulting scope.

## Error and failure conditions

- Pattern errors during lambda invocation MUST propagate as runtime outcomes.
- A failed lambda argument-pattern match MUST produce a failure-compatible
  runtime outcome rather than an implicit success value.

## Composition intent

- Lambda expressions SHOULD provide lightweight compositional projection logic
  without requiring top-level rule declarations.

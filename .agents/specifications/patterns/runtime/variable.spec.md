# Variable pattern

This chapter defines the logical contract for variable binding and capture in
runtime pattern matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `variable` pattern evaluates a child pattern and, on success, binds the
child pattern's matched value to a named variable in the resulting scope.

## Behavioral expectations

- A `variable` pattern MUST reject duplicate variable names already present in
  the current scope.
- If the variable name already exists in scope, the `variable` pattern MUST
  report a duplicate-variable error.
- A `variable` pattern MUST evaluate its child pattern against the current
  matching scope.
- If the child pattern succeeds, the `variable` pattern MUST succeed.
- If the child pattern fails, the `variable` pattern MUST fail.
- If the child pattern reports an error, the `variable` pattern MUST propagate
  that error.
- If the child pattern reports a left-recursion outcome, the `variable` pattern
  MUST propagate that outcome unchanged.

## Left-recursion behavior

- A `variable` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `variable` pattern MUST NOT convert a left-recursion outcome into failure
  or success.

## Input consumption

- A `variable` pattern MUST consume the same amount of input as its child
  pattern when the child succeeds.
- A `variable` pattern MUST NOT consume input when the child fails.
- A `variable` pattern MUST NOT consume input when duplicate-variable checking
  fails before child evaluation.

## Expected output

- On success, the `variable` pattern MUST report the child pattern's matched
  value as its output value.
- On failure, the `variable` pattern MUST report failure output.

## Scope binding behavior

- On success, the `variable` pattern MUST add a binding from the declared
  variable name to the child pattern's matched value in the resulting scope.
- The added binding MUST be visible to subsequent pattern evaluation and
  expression execution within the resulting scope.
- A `variable` pattern MUST NOT overwrite an existing binding in the current
  scope.

## Error conditions

- Duplicate variable name in the current scope MUST report a duplicate-variable
  error.

## Side effects

- The `variable` pattern MUST NOT produce externally observable side effects
  beyond its match result, resulting scope state, and resulting matching
  context.
- Binding the child pattern's matched value into the resulting scope is an
  intended side effect of the `variable` pattern.

## Composition intent

- The `variable` pattern SHOULD be used to name matched values for later use in
  the same rule, nested patterns, or rule expressions.
- The `variable` pattern MAY be composed with sequencing, conjunction,
  traversal, alternation, and binding-sensitive patterns to structure runtime
  data extraction.

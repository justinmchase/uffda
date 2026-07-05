# Then pattern

This chapter defines the logical contract for sequential pattern composition.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `then` pattern evaluates child patterns in sequence, where each child
pattern runs after the previous child pattern succeeds.

## Behavioral expectations

- A `then` pattern MUST evaluate child patterns in declaration order.
- Each child pattern MUST be evaluated against the current matching scope at
  the point it is reached.
- If a child pattern succeeds, the `then` pattern MUST continue to the next
  child pattern.
- If any child pattern fails, the `then` pattern MUST fail.
- If any child pattern reports an error, the `then` pattern MUST propagate that
  error immediately.
- If any child pattern reports a left-recursion outcome, the `then` pattern
  MUST propagate that outcome unchanged.
- A `then` pattern with no child patterns MUST succeed.

## Left-recursion behavior

- If any child pattern reports a left-recursion outcome, the `then` pattern
  MUST propagate that outcome unchanged.
- The `then` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- A `then` pattern MUST consume input only through successful child pattern
  evaluation.
- Each successful child pattern MAY advance the matching input position.
- If a child pattern fails, the `then` pattern MUST fail without committing a
  successful result for the sequence.
- If a `then` pattern with one or more successful child patterns later fails,
  the resulting failure MUST be reported from the original caller-visible scope.
- A `then` pattern with no child patterns MUST succeed without consuming input.

## Expected output

- On success, the `then` pattern MUST report an ordered array of each child
  pattern's matched value.
- On success with no child patterns, the `then` pattern MUST report an empty
  array.
- On failure, the `then` pattern MUST report failure output.

## Error conditions

- The `then` pattern itself does not introduce new error states.

## Side effects

- The `then` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `then` pattern SHOULD be used to express ordered grammar fragments where
  every step must succeed in sequence.
- The `then` pattern MAY be composed with alternation, traversal, and boundary
  assertions to build larger composite rules.

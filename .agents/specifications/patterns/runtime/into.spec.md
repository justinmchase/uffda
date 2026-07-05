# Into pattern

This chapter defines the logical contract for traversal into nested iterable
runtime values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `into` pattern applies a child pattern to the contents of a single
iterable input item, treating that item as a nested input stream.

## Behavioral expectations

- An `into` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `into` pattern
  MUST fail.
- The current input item MUST be iterable for the `into` pattern to proceed.
- If the current input item is not iterable, the `into` pattern MUST report an
  iterable-expected error.
- If the current input item is iterable, the `into` pattern MUST evaluate its
  child pattern against that nested iterable as an independent input stream.
- The child pattern MUST consume the entire nested input stream for the `into`
  pattern to succeed.
- If the child pattern does not consume the entire nested input stream, the
  `into` pattern MUST fail.
- If the child pattern fails or reports an error, the `into` pattern MUST
  propagate that outcome according to the runtime matching model.

## Left-recursion behavior

- An `into` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- An `into` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- An `into` pattern MUST consume exactly one outer input item when it succeeds.
- An `into` pattern MUST NOT consume outer input when it fails.
- An `into` pattern MUST NOT consume outer input when the current item is not
  iterable and an error is reported.
- The nested input stream consumed by the child pattern is the entirety of the
  current outer input item.

## Expected output

- On success, the `into` pattern MUST report the child pattern's matched value
  as its output value.
- On failure, the `into` pattern MUST report failure output.

## Error conditions

- If the current input item is not iterable, the `into` pattern MUST report an
  iterable-expected error.

## Side effects

- The `into` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `into` pattern SHOULD be used when a single outer value contains a nested
  sequence that should be matched as its own input stream.
- The `into` pattern MAY be composed with sequencing, traversal, and
  constraint patterns to express nested grammar structures.

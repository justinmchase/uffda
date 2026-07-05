# End pattern

This chapter defines the logical contract for end-of-input boundary matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `end` pattern asserts that no further input items are available at the
current input position.

## Behavioral expectations

- An `end` pattern MUST inspect whether the current input position is at
  end-of-input.
- If the current input position is at end-of-input, the `end` pattern MUST
  succeed.
- If additional input items are available, the `end` pattern MUST fail.
- The `end` pattern MUST NOT consume input.
- On both success and failure, the resulting input position MUST remain the
  same as the incoming input position.

## Input consumption

- An `end` pattern MUST NOT consume input in any outcome.
- An `end` pattern MUST succeed only when the current input is already fully
  consumed.

## Expected output

- On success, the `end` pattern MUST report success output with no consumed
  item value.
- On failure, the `end` pattern MUST report failure output.

## Error conditions

- The `end` pattern itself does not introduce new error states.

## Side effects

- The `end` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `end` pattern SHOULD be used as an explicit boundary assertion to ensure
  a larger composite pattern consumes the intended complete input.
- The `end` pattern MAY be composed with sequencing, negation, and alternation
  to express completion-sensitive grammars.

# Ok pattern

This chapter defines the logical contract for explicit success assertions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `ok` pattern forces a match success regardless of the current input
position or input state.

## Behavioral expectations

- An `ok` pattern MUST succeed in all circumstances.
- An `ok` pattern MUST NOT inspect or depend on the current input value.
- An `ok` pattern MUST leave the resulting input position unchanged.

## Input consumption

- An `ok` pattern MUST NOT consume input.
- An `ok` pattern MUST succeed without consumption.

## Expected output

- An `ok` pattern MUST report success output.
- An `ok` pattern MUST report `undefined` as its output value.

## Error conditions

- The `ok` pattern itself does not introduce new error states.

## Side effects

- The `ok` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `ok` pattern SHOULD be used as an explicit sentinel for unconditional
  success.
- The `ok` pattern MAY be composed with negation, alternation, and other
  control-oriented patterns to express structural matching rules.

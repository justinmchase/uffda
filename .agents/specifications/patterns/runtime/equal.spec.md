# Equal pattern

This chapter defines the logical contract for strict literal-value matching at
the current input position.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `equal` pattern matches exactly one input item when that item is strictly
equal to the pattern's declared literal value.

## Behavioral expectations

- An `equal` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `equal` pattern
  MUST fail.
- If an input item is available, the `equal` pattern MUST compare that item to
  the declared literal value using JavaScript strict equality semantics (`===`).
- If the comparison succeeds, the `equal` pattern MUST succeed and advance the
  resulting input position by exactly one item.
- If the comparison fails, the `equal` pattern MUST fail.

## Input consumption

- An `equal` pattern MUST consume exactly one input item when it succeeds.
- An `equal` pattern MUST NOT consume input when it fails.
- An `equal` pattern MUST fail without consumption at end-of-input.

## Expected output

- On success, the `equal` pattern MUST report the consumed input item as its
  output value.
- On failure, the `equal` pattern MUST report failure output.

## Error conditions

- The `equal` pattern itself does not introduce new error states.

## Side effects

- The `equal` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `equal` pattern SHOULD be used for exact token or sentinel matching where
  strict identity with a declared literal is required.
- The `equal` pattern MAY be composed with sequencing, alternation,
  conjunction, and boundary assertions to express precise grammar constraints.

# Type pattern

This chapter defines the logical contract for runtime type-guard matching over
JavaScript values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `type` pattern matches exactly one input item when that item's runtime type
matches the pattern's declared type.

## Behavioral expectations

- A `type` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `type` pattern
  MUST fail.
- The current input item MUST be checked against the declared runtime type.
- If the current input item's runtime type matches the declared type, the
  `type` pattern MUST succeed.
- If the current input item's runtime type does not match the declared type,
  the `type` pattern MUST fail.

## Input consumption

- A `type` pattern MUST consume exactly one input item when it succeeds.
- A `type` pattern MUST NOT consume input when it fails.
- A `type` pattern MUST fail without consumption at end-of-input.

## Expected output

- On success, the `type` pattern MUST report the consumed input item as its
	output value.
- On failure, the `type` pattern MUST report failure output.

## Error conditions

- The `type` pattern itself does not introduce new error states.

## Side effects

- The `type` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `type` pattern SHOULD be used as a runtime type guard in larger pattern
  compositions.
- The `type` pattern is especially useful inside the `and` pattern, where each
  child pattern evaluates against the same input and `type` can act as a guard
  that constrains the shared value before other conjuncts inspect it.
- The `type` pattern MAY be composed with sequencing, alternation,
  conjunction, and traversal patterns to constrain runtime value kinds.

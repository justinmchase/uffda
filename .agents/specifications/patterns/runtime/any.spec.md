# Any pattern

This chapter defines the logical contract for wildcard matching at the current
input position.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `any` pattern matches exactly one available input item regardless of its
runtime type or value.

## Behavioral expectations

- An `any` pattern MUST inspect the current input position.
- If an input item is available, the `any` pattern MUST succeed.
- On success, the `any` pattern MUST advance the resulting input position by
  exactly one item.
- If no input item is available at the current position, the `any` pattern MUST
  fail.

## Expected output

- On success, the `any` pattern MUST report the consumed input item as its
  output value.
- On failure at end-of-input, the `any` pattern MUST report failure output.

## Error conditions

- The `any` pattern itself does not introduce new error states.

## Side effects

- The `any` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `any` pattern SHOULD be used as a wildcard primitive in larger composite
  patterns.
- The `any` pattern MAY be combined with sequencing, conjunction, alternation,
  and traversal-oriented patterns.

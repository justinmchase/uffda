# Character pattern

This chapter defines the logical contract for character-class matching at the
current input position.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `character` pattern matches exactly one input item against a declared
Unicode character class.

## Behavioral expectations

- A `character` pattern MUST inspect the current input position.
- If the input is already at end-of-input, the `character` pattern MUST fail.
- A `character` pattern MUST read at most one input item.
- The inspected input item MUST be a JavaScript string value to be eligible for
  class-based matching.
- If the inspected item is a string and belongs to the declared character
  class, the `character` pattern MUST succeed and advance the resulting input
  position by exactly one item.
- If the inspected item is a string but does not belong to the declared
  character class, the `character` pattern MUST fail.

## Input consumption

- A `character` pattern MUST consume exactly one input item when it succeeds.
- A `character` pattern MUST NOT consume input when it fails.
- A `character` pattern MUST fail without consumption at end-of-input.

## Expected output

- On success, the `character` pattern MUST report the consumed string item as
  its output value.
- On fail, the `character` pattern MUST report failure output.

## Error conditions

- If the inspected input item is not a string, the `character` pattern MUST
  report a type error.
- If the declared character class is unknown to the runtime implementation, the
  runtime MUST report an error rather than silently treating the input as a
  non-match.

## Side effects

- The `character` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `character` pattern SHOULD be used as a Unicode-aware primitive for
  token-like and lexical matching.
- The `character` pattern MAY be composed with sequencing, repetition,
  alternation, and traversal-oriented patterns to build larger grammars.

# RegExp pattern

This chapter defines the logical contract for regular-expression matching
against string input items.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `regexp` pattern matches exactly one string input item when that string
matches the pattern's declared JavaScript `RegExp` value.

## Behavioral expectations

- A `regexp` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `regexp` pattern
  MUST fail.
- The current input item MUST be a JavaScript string value for the `regexp`
  pattern to proceed.
- If the current input item is not a string value, the `regexp` pattern MUST
  report a type error.
- The `regexp` pattern MUST evaluate the declared `RegExp` against the current
  string input item using JavaScript regular-expression matching semantics.
- If the regular expression matches the current string input item, the `regexp`
  pattern MUST succeed.
- If the regular expression does not match the current string input item, the
  `regexp` pattern MUST fail.

## Input consumption

- A `regexp` pattern MUST consume exactly one input item when it succeeds.
- A `regexp` pattern MUST NOT consume input when it fails.
- A `regexp` pattern MUST NOT consume outer input when it reports a type error.
- A `regexp` pattern MUST fail without consumption at end-of-input.

## Expected output

- On success, the `regexp` pattern MUST report the consumed string item as its
  output value.
- On failure, the `regexp` pattern MUST report failure output.

## Error conditions

- If the current input item is not a string value, the `regexp` pattern MUST
  report a type error.

## Side effects

- The `regexp` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `regexp` pattern SHOULD be used for direct lexical and token-like string
  matching.
- The `regexp` pattern MAY be composed with sequencing, alternation,
  conjunction, and traversal patterns to express regex-based grammar rules.

## Examples

### Match a whitespace-free word token

```
// Pattern object
regexp(/^\S+$/)
```

```
// Grammar rule
Word = /^\S+$/
```

Input `"hello"` succeeds with value `"hello"`. Input `"hello world"` fails
because the string contains whitespace.

---

### Match a floating-point literal string

```
// Pattern object
regexp(/^-?\d+(\.\d+)?$/)
```

```
// Grammar rule
FloatLiteral = /^-?\d+(\.\d+)?$/
```

Input `"3.14"` succeeds. Input `"3."` fails (decimal point with no following
digits). Input `[42]` (a number, not a string) produces a type error.

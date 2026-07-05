# Except pattern

This chapter defines the logical contract for consuming input that does not
match a specified pattern.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `except` pattern matches and consumes exactly one input item that does not
match a given pattern. It completes the `not`/`any` family by providing a named
primitive for the common idiom of "consume any item except this".

## Behavioral expectations

- An `except` pattern MUST inspect the current input position.
- If the input is already at end-of-input, the `except` pattern MUST fail.
- An `except` pattern MUST evaluate its child pattern against the current input
  position **without consuming input** (zero-width assertion).
- If the child pattern fails, the `except` pattern MUST succeed and consume
  exactly one input item.
- If the child pattern succeeds, the `except` pattern MUST fail without
  consuming input.
- An `except` pattern MUST report the consumed input item as its output value on
  success.

## Left-recursion behavior

- The child pattern in an `except` pattern is evaluated with zero-width
  semantics (no input consumption for assertion purposes).
- Left-recursion seeding and growth do not apply to the assertion phase.
- If the assertion succeeds (child pattern fails), the consuming phase does not
  involve recursion.

## Input consumption

- An `except` pattern MUST consume exactly one input item when it succeeds.
- An `except` pattern MUST NOT consume input when it fails (including when the
  child pattern matches).
- An `except` pattern MUST NOT consume input at end-of-input.

## Expected output

- On success, the `except` pattern MUST report the consumed input item as its
  output value.
- On failure, the `except` pattern MUST report failure output.

## Error conditions

- If the inspected input item is not a string and the child pattern does not
  match it, the `except` pattern MUST succeed and consume that item.
- If the child pattern reports an error during assertion, the `except` pattern
  MUST report that error without consuming input.

## Side effects

- The `except` pattern MUST NOT produce externally observable side effects
  beyond its match result and the match result of the child pattern's zero-width
  assertion.

## Composition intent

- The `except` pattern SHOULD be used for scanning and content-matching
  scenarios where input should be consumed up to (but not including) a sentinel
  or excluded pattern.
- The `except` pattern SHOULD be composed with quantification (`*`, `+`) to
  match sequences of items that do not satisfy a constraint.
- The `except` pattern MAY be composed with sequencing and alternation to build
  lexical and syntactic patterns.

## Examples

### Match any character except a newline

Consume characters until a newline is encountered.

```
// Pattern object
quantifier(except(equal("\n")))
```

```
// Grammar rule
LineContent = ~"\n"*
```

Input `"hello world"` succeeds with value
`["h", "e", "l", "l", "o", " ",
"w", "o", "r", "l", "d"]`. Input
`"hello\nworld"` matches only up to the newline, returning
`["h", "e", "l", "l", "o"]`.

---

### Match quoted string content

Match the content of a quoted string: any characters except the closing quote.

```
// Pattern object
then([
  quote:includes(["\"", "'"]),
  quantifier(except(resolve(quote))),
  resolve(quote)
])
```

```
// Grammar rule
QuotedString = quote:("\"" | "'") ~quote* quote
```

Input `"\"hello\""` succeeds with `quote = "\""` and consumes `hello` (all
characters except `"`). The final `quote` then matches the closing `"`. Input
`"\"hello'"` fails because the closing quote doesn't match the opening quote.

---

### Match tokens separated by whitespace, stopping at a keyword

Consume non-whitespace tokens until the keyword `"end"` is encountered.

```
// Pattern object
quantifier(except(equal("end")))
```

```
// Grammar rule
Tokens = ~"end"+
```

Input `"foo bar baz end"` would match `["foo", " ", "bar", " ", "baz", " "]`
(stopping before `"end"`). Input `"foo bar baz qux"` matches the entire input
since `"end"` is never encountered.

---

### Scan until a sentinel value

Use `except` in a loop to consume values until a specific sentinel is found.

```
// Pattern object
then([
  quantifier(except(equal(0))),  // consume values until 0
  equal(0)                       // consume the sentinel
])
```

```
// Grammar rule
UntilZero = ~0* 0
```

Input `[1, 2, 3, 0]` succeeds with `[[1, 2, 3], 0]`. Input `[1, 2, 3]` fails
because the sentinel is not found.

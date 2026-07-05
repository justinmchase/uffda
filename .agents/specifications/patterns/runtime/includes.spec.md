# Includes pattern

This chapter defines the logical contract for membership matching against a
declared set of literal values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `includes` pattern matches exactly one input item when that item is a member
of the pattern's declared literal value set.

## Behavioral expectations

- An `includes` pattern MUST inspect the current input position.
- If the declared value set is empty, the `includes` pattern MUST fail for any
  available input item.
- If no input item is available at the current position, the `includes` pattern
  MUST fail.
- If an input item is available, the `includes` pattern MUST check whether that
  item is present in the declared value set using JavaScript array membership
  semantics.
- If the input item is present in the declared value set, the `includes` pattern
  MUST succeed.
- If the input item is not present in the declared value set, the `includes`
  pattern MUST fail.

## Input consumption

- An `includes` pattern MUST consume exactly one input item when it succeeds.
- An `includes` pattern MUST NOT consume input when it fails.
- An `includes` pattern MUST fail without consumption at end-of-input.

## Expected output

- On success, the `includes` pattern MUST report the consumed input item as its
  output value.
- On failure, the `includes` pattern MUST report failure output.

## Error conditions

- The `includes` pattern itself does not introduce new error states.

## Side effects

- The `includes` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `includes` pattern SHOULD be used for token membership and reserved-value
  matching against a fixed literal set.
- The `includes` pattern MAY be composed with sequencing, alternation,
  conjunction, and boundary assertions to express set-based grammar rules.

## Examples

### Match any reserved keyword

```
// Pattern object
includes(["if", "while", "for", "return"])
```

```
// Grammar rule
Keyword = "if" | "while" | "for" | "return"
```

Input `"while"` succeeds with value `"while"`. Input `"foo"` fails.

---

### Match an arithmetic operator

```
// Pattern object
then([
  any,               // left operand
  includes(["+", "-", "*", "/"]),
  any                // right operand
])
```

```
// Grammar rule
BinaryExpr = . ("+" | "-" | "*" | "/") .
```

Input `[1, "+", 2]` succeeds with value `[1, "+", 2]`. Input `[1, "^", 2]` fails
at the `includes` step.

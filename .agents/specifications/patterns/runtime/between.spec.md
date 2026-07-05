# Between pattern

This chapter defines the logical contract for closed-interval matching over
ordered values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `between` pattern matches exactly one input item when that item's value
falls within the inclusive closed interval `[left, right]` defined by the
pattern's declared bounds.

## Behavioral expectations

- A `between` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `between` pattern
  MUST fail.
- If the current input item is null or undefined, the `between` pattern MUST
  report a null-value error.
- The types of the left bound, right bound, and input value MUST all be
  identical for a range comparison to proceed.
- If the types are not identical, the `between` pattern MUST fail.
- For string and number values, the `between` pattern MUST compare the input
  value against the bounds using native JavaScript ordering semantics.
- For object values implementing a `compareTo` method, the `between` pattern
  MUST compare using the object's `compareTo` ordering.
- For object values that do not implement `compareTo`, the `between` pattern
  MUST fail.
- If the input value is within the closed interval `[left, right]` inclusive,
  the `between` pattern MUST succeed.
- If the input value is outside that interval, the `between` pattern MUST fail.

## Input consumption

- A `between` pattern MUST consume exactly one input item when it succeeds.
- A `between` pattern MUST NOT consume input when it fails.
- A `between` pattern MUST fail without consumption at end-of-input.
- A `between` pattern MUST NOT consume input when it reports a null-value error.

## Expected output

- On success, the `between` pattern MUST report the consumed input item as its
  output value.
- On failure, the `between` pattern MUST report failure output.

## Error conditions

- A null or undefined input value MUST report a null-value error.

## Side effects

- The `between` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `between` pattern SHOULD be used for ordered value interval matching where
  a character, number, or comparable object must fall within declared bounds.
- The `between` pattern MAY be composed with alternation, conjunction,
  sequencing, and quantifier patterns to express interval-based grammar rules.

## Naming note

- This chapter uses `between` as the canonical name for this pattern.
- The former name `range` was replaced because `range` carries strong array or
  sequence connotations in JavaScript that do not match this pattern's actual
  predicate behavior.
- `between(left, right)` reads as a self-documenting interval membership test
  and aligns with the readable style of `equal`, `includes`, and `type`.

## Examples

### Match a decimal digit character

```
// Pattern object
between("0", "9")
```

```
// Grammar rule
DecimalDigit = "0".."9"
```

Input `"5"` succeeds with value `"5"`. Input `"a"` fails.

---

### Match a lowercase ASCII letter

```
// Pattern object
between("a", "z")
```

```
// Grammar rule
LowercaseLetter = "a".."z"
```

Input `"m"` succeeds. Input `"A"` fails because `"A"` falls outside the
`["a", "z"]` interval using JavaScript string comparison.

---

### Match a numeric value in a bounded range

Match a single number from an array when that number is a valid HTTP status code
in the success range.

```
// Pattern object
between(200, 299)
```

```
// Grammar rule
SuccessStatus = 200..299
```

Input `[204]` succeeds with value `204`. Input `[404]` fails.

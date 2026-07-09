# Quantifier pattern

This chapter defines the logical contract for bounded repetition of a child
pattern.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `quantifier` pattern repeatedly evaluates a child pattern and collects each
successful child value into an ordered array, optionally constrained by minimum
and maximum repetition bounds.

## Behavioral expectations

- A `quantifier` pattern MUST validate `min` and `max` arguments before child
  evaluation.
- If `min` is provided, it MUST be an integer greater than or equal to zero.
- If `max` is provided, it MUST be either positive infinity or an integer
  greater than or equal to zero.
- If both `min` and `max` are provided, `max` MUST be greater than or equal to
  `min`.
- Invalid repetition bounds MUST report an invalid-argument error.
- A `quantifier` pattern MUST evaluate its child pattern repeatedly in
  declaration context until one of the following stop conditions occurs:
  1. The child pattern fails.
  2. The `max` bound is reached.
  3. The input stream is exhausted.
  4. A non-progressing successful child match reaches the minimum required
     repetition threshold.
- If the child pattern reports an error, the `quantifier` pattern MUST propagate
  that error.
- If the child pattern reports a left-recursion outcome, the `quantifier`
  pattern MUST propagate that outcome unchanged.

## Left-recursion behavior

- A `quantifier` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `quantifier` pattern MUST NOT convert a left-recursion outcome into failure
  or success.

## Input consumption

- A `quantifier` pattern MUST consume input only through successful child
  pattern evaluation.
- A `quantifier` pattern MUST preserve the original input position when it fails
  due to not meeting the minimum repetition bound.
- When the child pattern succeeds without advancing input, the `quantifier`
  pattern MUST apply a progress guard to prevent non-terminating repetition.
- For non-progressing child successes, the `quantifier` pattern MUST terminate
  once minimum repetition requirements are satisfied.

## Expected output

- On success, the `quantifier` pattern MUST report an ordered array of child
  matched values.
- On success with zero repetitions, the `quantifier` pattern MUST report an
  empty array.
- On failure from unmet minimum repetition count, the `quantifier` pattern MUST
  report failure output.

## Error conditions

- Invalid `min` or `max` arguments MUST report an invalid-argument error.

## Side effects

- The `quantifier` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `quantifier` pattern SHOULD be used as the primary repetition form for
  child patterns, including optional, Kleene-star, and bounded-repeat
  constructs.
- The `quantifier` pattern MAY be composed with sequencing, alternation,
  conjunction, traversal, and pipeline patterns.

## Naming note

- This chapter uses `quantifier` as the canonical name for this pattern family.
- The pattern supports:
  1. zero-or-more (`min` omitted or `0`, `max` omitted),
  2. zero-or-one (`min: 0, max: 1`),
  3. one-or-more (`min: 1`, `max` omitted),
  4. exact and bounded repetition (`min` and `max` both specified).

## Examples

### Zero-or-more: collect all letters

```
// Pattern object
quantifier(character(CharacterClass.Letter))
```

```
// Grammar rule
Letters = \cL*
```

Input `"abc"` succeeds with value `["a", "b", "c"]`. Input `""` or `[]` succeeds
with value `[]`.

---

### One-or-more: require at least one digit

```
// Pattern object
quantifier(character(CharacterClass.DecimalDigitNumber), { min: 1 })
```

```
// Grammar rule
Integer = \cNd+
```

Input `"42"` succeeds with `["4", "2"]`. Input `""` fails because the minimum
count of `1` is not met.

---

### Exact count: match exactly three hex digits

```
// Pattern object
quantifier(between("0", "9"), { min: 3, max: 3 })
```

```
// Grammar rule
ThreeDigits = \cNd{3}
```

Input `"123"` succeeds with `["1", "2", "3"]`. Input `"12"` fails; input
`"1234"` succeeds matching only the first three digits, leaving `"4"`
unconsumed.

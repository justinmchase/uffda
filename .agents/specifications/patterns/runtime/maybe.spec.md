# Maybe pattern

This chapter defines the logical contract for optional matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `maybe` pattern makes a child pattern optional by converting child failure
into success with an undefined value.

## Behavioral expectations

- A `maybe` pattern MUST evaluate its child pattern against the current input
  position.
- If the child pattern succeeds, the `maybe` pattern MUST succeed.
- If the child pattern fails, the `maybe` pattern MUST still succeed.
- If the child pattern reports an error, the `maybe` pattern MUST propagate that
  error.
- If the child pattern reports a left-recursion outcome, the `maybe` pattern
  MUST propagate that outcome.

## Left-recursion behavior

- A `maybe` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `maybe` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- A `maybe` pattern MUST consume the same amount of input as its child pattern
  when the child succeeds.
- A `maybe` pattern MUST NOT consume input when the child fails.
- A `maybe` pattern MUST leave the input position unchanged when the child
  fails.

## Expected output

- When the child pattern succeeds, the `maybe` pattern MUST report the child's
  matched value as its output value.
- When the child pattern fails, the `maybe` pattern MUST report `undefined` as
  its output value.

## Error conditions

- The `maybe` pattern itself does not introduce new error states.

## Side effects

- The `maybe` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `maybe` pattern SHOULD be used when a child pattern is permitted but not
  required to match.
- The `maybe` pattern MAY be composed with sequencing, alternation, and
  traversal patterns to express optional grammar fragments.

## Examples

### Optional sign prefix on a number

```
// Pattern object
then([
  maybe(includes(["+", "-"])),
  quantifier(character(CharacterClass.DecimalDigitNumber), { min: 1 })
])
```

```
// Grammar rule
SignedInteger = ("+" | "-")? DecimalDigit+
```

Input `["-", "4", "2"]` succeeds with value `["-", ["4", "2"]]`. Input
`["4", "2"]` succeeds with value `[undefined, ["4", "2"]]` — the absent sign
yields `undefined`.

---

### Optional trailing separator

Allow but do not require a comma after each element in a list.

```
// Pattern object
then([
  any,
  maybe(equal(","))
])
```

```
// Grammar rule
ListElement = . ","?
```

Input `["x", ","]` succeeds with value `["x", ","]`. Input `["x"]` succeeds with
value `["x", undefined]`.

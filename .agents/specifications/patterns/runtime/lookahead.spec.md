# Lookahead pattern

This chapter defines the logical contract for positive lookahead assertion.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `lookahead` pattern asserts that a child pattern matches at the current
input position without consuming any input. It is the and-predicate (`&e`)
from Ford's PEG formalism and the zero-width complement to the `not` pattern's
zero-width negative assertion.

## Behavioral expectations

- A `lookahead` pattern MUST evaluate its child pattern against the current
  input position.
- If the child pattern succeeds, the `lookahead` pattern MUST succeed.
- If the child pattern fails, the `lookahead` pattern MUST fail.
- If the child pattern reports an error, the `lookahead` pattern MUST propagate
  that error.
- If the child pattern reports a left-recursion outcome, the `lookahead`
  pattern MUST propagate that outcome unchanged.

## Left-recursion behavior

- A `lookahead` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `lookahead` pattern MUST NOT convert a left-recursion outcome into failure
  or success.

## Input consumption

- A `lookahead` pattern MUST NOT consume input in any outcome.
- A `lookahead` pattern MUST leave the input position unchanged regardless of
  whether the child pattern succeeds or fails.

## Expected output

- When the child pattern succeeds, the `lookahead` pattern MUST report
  `undefined` as its output value.
- When the child pattern fails, the `lookahead` pattern MUST report failure
  output.

## Error conditions

- The `lookahead` pattern itself does not introduce new error states.

## Side effects

- The `lookahead` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `lookahead` pattern SHOULD be used to assert a condition on the upcoming
  input without committing to consuming it.
- The `lookahead` pattern is the zero-width positive counterpart to `not`,
  which is the zero-width negative assertion.
- The `lookahead` pattern SHOULD be preferred over the `not(not(e))`
  workaround, which is non-obvious and produces confusing match trees.
- The `lookahead` pattern MAY be composed with `or` to dispatch on the next
  input item type or value without consuming it before the selected branch runs.
- The `lookahead` pattern MAY be composed with sequencing to assert a boundary
  condition — such as what does NOT follow — that the consuming patterns in the
  sequence do not themselves enforce.
- Using `lookahead(e)` immediately before a consuming pattern whose first step
  is already `e` is redundant; in Uffda's `or`, failed branches always restore
  the original input position without a `lookahead` wrapper.

## Examples

### Assert a sign token is followed by a digit

Match a `+` or `-` sign only when the very next item is a number. The sign
pattern consumes the sign; `lookahead` checks what follows without consuming
it. This is non-redundant because the consuming pattern (`includes`) has no
knowledge of what comes after it — the post-condition must be stated
separately.

```
then([
  includes(["+", "-"]),
  lookahead(type(Type.Number))
])
```

Input `["+", 42]` succeeds with value `["+", undefined]`. Input `["+", "x"]`
fails at the `lookahead` step after the sign has been consumed — so this
example is best used inside an `or` branch where that partial consumption is
acceptable, or wrapped with the parent pattern designed to handle it.

---

### Dispatch on the next token without consuming it

Use `lookahead` inside `or` to choose a branch based on the upcoming value.
Each branch peeks at the token and then handles it with its own consuming
pattern.

```
or([
  then([lookahead(equal("+")), addExpression]),
  then([lookahead(equal("-")), subtractExpression]),
])
```

The `lookahead` checks which operator is next without consuming it, leaving
the operator available for `addExpression` or `subtractExpression` to consume
as part of their own patterns.

---

### Assert a boundary condition not checked by the consuming pattern

Match the characters that spell `"return"`, then assert the very next character
is NOT a letter. Without the `lookahead`, a name like `"returning"` would
partially match the keyword characters and only fail later. The `lookahead`
makes the keyword boundary an explicit zero-width gate that the consuming
character patterns do not themselves enforce.

```
then([
  equal("r"), equal("e"), equal("t"),
  equal("u"), equal("r"), equal("n"),
  lookahead(not(character(CharacterClass.Letter)))
])
```

Input `"return "` succeeds. Input `"returning"` fails at the `lookahead` step,
leaving the entire input unconsumed for the parent `or` to try an identifier
branch instead.

---

### Contrast with `not(not(e))` — the equivalent workaround

`not(not(e))` produces the same zero-width positive assertion but is
non-obvious and generates extra internal match nodes. `lookahead(e)` is the
preferred and semantically clear form.

```
// Equivalent but discouraged:
not(not(type(Type.String)))

// Preferred:
lookahead(type(Type.String))
```

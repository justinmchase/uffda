# Ok pattern

This chapter defines the logical contract for explicit success assertions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `ok` pattern forces a match success regardless of the current input position
or input state.

## Behavioral expectations

- An `ok` pattern MUST succeed in all circumstances.
- An `ok` pattern MUST NOT inspect or depend on the current input value.
- An `ok` pattern MUST leave the resulting input position unchanged.

## Input consumption

- An `ok` pattern MUST NOT consume input.
- An `ok` pattern MUST succeed without consumption.

## Expected output

- An `ok` pattern MUST report success output.
- An `ok` pattern MUST report `undefined` as its output value.

## Error conditions

- The `ok` pattern itself does not introduce new error states.

## Side effects

- The `ok` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `ok` pattern SHOULD be used as an explicit sentinel for unconditional
  success.
- The `ok` pattern MAY be composed with negation, alternation, and other
  control-oriented patterns to express structural matching rules.

## Examples

### Unconditional success at any position

```
// Pattern object
ok
```

```
// Grammar rule
Epsilon = ok
```

Always succeeds with value `undefined` without consuming input, even at
end-of-input.

---

### Use `not(ok)` to force unconditional failure

Because `ok` always succeeds, `not(ok)` always fails. This is the idiomatic way
to express an unconditional dead-end without using `fail` directly.

```
// Pattern object
not(ok)
```

Always fails. Semantically equivalent to `fail` but derived from composition
rather than as a primitive.

---

### Provide an identity base case in alternation

Use `ok` as the final branch of an `or` to express that the entire alternation
should succeed even when no branch matched anything meaningful.

```
// Pattern object
or([
  type(Type.Number),
  type(Type.String),
  ok   // fallthrough — succeed with undefined
])
```

Input `[true]` reaches the `ok` branch and succeeds with `undefined`.

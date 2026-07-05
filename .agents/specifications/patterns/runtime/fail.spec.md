# Fail pattern

This chapter defines the logical contract for explicit failure assertions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `fail` pattern forces a match failure regardless of the current input
position or any consumed input state.

## Behavioral expectations

- A `fail` pattern MUST fail in all circumstances.
- A `fail` pattern MUST NOT inspect or depend on the current input value.
- A `fail` pattern MUST NOT consume input.
- A `fail` pattern MUST leave the resulting input position unchanged.

## Input consumption

- A `fail` pattern MUST NOT consume input.
- A `fail` pattern MUST fail without consumption.

## Expected output

- A `fail` pattern MUST report failure output.

## Error conditions

- The `fail` pattern itself does not introduce new error states.

## Side effects

- The `fail` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `fail` pattern SHOULD be used as an explicit sentinel when a branch must
  be made impossible.
- The `fail` pattern MAY be composed with alternation, negation, and
  higher-level control patterns to enforce structural constraints.

## Examples

### Mark a dead branch as explicit

Use `fail` as the final branch of an `or` to make the "no match" case
intentional and visible rather than implicit.

```
// Pattern object
or([
  then([equal("add"), ...]),
  then([equal("sub"), ...]),
  fail  // no other opcodes are valid
])
```

```
// Grammar rule
Instruction = "add" AddArgs | "sub" SubArgs | fail
```

`fail` is unconditional — it always produces failure output regardless of
the current input.

---

### Verify `not(fail)` always succeeds

Because `fail` always fails, `not(fail)` is logically equivalent to `ok`.
This is occasionally useful as a documentation tool to express that a
branch is always satisfiable.

```
// Pattern object
not(fail)
```

Always succeeds with value `undefined` without consuming input.

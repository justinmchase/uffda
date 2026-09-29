# Recover pattern

This chapter defines the logical contract for a grammar-declared error recovery
point.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `recover` pattern marks where a grammar can resume after a syntax error:
when its child pattern fails and recovery is enabled, it matches a skip pattern
over the erroneous input instead and succeeds with a recovered match. See
[runtime error recovery](../../runtime/error-recovery.spec.md) for the recovery
setting and how recovered matches compose.

## Behavioral expectations

- A `recover` pattern MUST evaluate its child pattern at the current position.
- If the child succeeds, the `recover` pattern MUST succeed with the child's
  outcome.
- If the child fails and recovery is disabled, the `recover` pattern MUST fail.
- If the child fails and recovery is enabled, the `recover` pattern MUST match
  its skip pattern at the same position, with recovery disabled:
  - if the skip pattern succeeds after consuming at least one item, the
    `recover` pattern MUST succeed with a recovered match;
  - otherwise the `recover` pattern MUST fail.
- The skip pattern MUST NOT be evaluated when the child succeeds or when
  recovery is disabled.
- Errors from the child or the skip pattern MUST be propagated.

## Left-recursion behavior

- A `recover` pattern MUST propagate a left-recursion outcome from its child or
  skip pattern unchanged.
- Recovery inside left-recursive growth is governed by
  [runtime error recovery](../../runtime/error-recovery.spec.md#left-recursion).

## Input consumption

- On child success, a `recover` pattern MUST consume exactly what its child
  consumed.
- On recovery, a `recover` pattern MUST consume exactly what its skip pattern
  consumed, which is at least one item.
- On failure, a `recover` pattern MUST NOT consume input.
- After a recovery, matching MUST continue with the recovery setting the
  `recover` pattern was invoked with.

## Expected output

- On child success, the value MUST be the child's value, and the outcome MUST be
  a skipped success when the child's is (see [skip](./skip.spec.md)).
- On recovery, the value MUST be the skip pattern's value, and the match MUST be
  marked recovered, retaining the child's failure and the skip pattern's success
  as its children, in that order. The recovery MUST be a skipped success when
  the skip pattern's success is skipped.
- A child failure that read a still-failing left-recursive seed MUST NOT be
  recovered from; see
  [runtime error recovery](../../runtime/error-recovery.spec.md#left-recursion).

## Error conditions

- The `recover` pattern itself does not introduce new error states.

## Side effects

- The `recover` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- Place `recover` around a construct that has a reliable resynchronization
  point, typically a repeated element: `recover(Statement, SkipStatement)*`.
- Write skip patterns that stop before the enclosing construct's terminator (for
  example `(not (";" | "}") any)+`), so a recovery never swallows input that
  belongs to its parent.
- Project the skip pattern to yield an error node of the language's AST, so
  later layers and compilers can see where recovery happened.

## Examples

### Recover a statement up to its terminator

In pattern syntax (see
[pattern grammar](../../languages/pattern-syntax/grammar.spec.md#recovery)):

```
(ope Statement sneak by until ";" ";")* end
```

As a pattern object:

```
// Pattern object
then([
  quantifier(then([
    recover(
      reference("Statement"),
      quantifier(then([not(equal(";")), any]), { min: 1 }),
    ),
    equal(";"),
  ])),
  end,
])
```

With recovery enabled, input `ab;xx;ab;` (where `Statement` matches `ab`)
succeeds: the second statement is a recovered match spanning `xx`, whose value
is the skipped items. With recovery disabled, the same input matches only the
first statement and the pattern fails at `end`.

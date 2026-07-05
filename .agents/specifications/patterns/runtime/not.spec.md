# Not pattern

This chapter defines the logical contract for negation-based matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `not` pattern succeeds when its child pattern fails and fails when its child
pattern succeeds.

## Behavioral expectations

- A `not` pattern MUST evaluate its child pattern against the current input
  position.
- If the child pattern succeeds, the `not` pattern MUST fail.
- If the child pattern fails, the `not` pattern MUST succeed.
- If the child pattern reports an error, the `not` pattern MUST propagate that
  error.
- If the child pattern reports a left-recursion outcome, the `not` pattern MUST
  propagate that outcome.

## Left-recursion behavior

- A `not` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `not` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- A `not` pattern MUST NOT consume input directly.
- When the child pattern succeeds, the `not` pattern MUST fail without consuming
  input.
- When the child pattern fails, the `not` pattern MUST succeed without consuming
  input.
- The `not` pattern MUST leave the input position unchanged in both outcomes.

## Expected output

- When the child pattern succeeds, the `not` pattern MUST report failure output.
- When the child pattern fails, the `not` pattern MUST report `undefined` as its
  output value.

## Error conditions

- The `not` pattern itself does not introduce new error states.

## Side effects

- The `not` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `not` pattern SHOULD be used to express negative predicates and guard
  conditions.
- The `not` pattern MAY be composed with sequencing, alternation, and traversal
  patterns to express exclusions and lookahead-like constraints.

## Examples

### Assert the next item is not a specific value

Check that the next item is not a closing brace without consuming it. The `not`
succeeds zero-width and leaves the input unchanged.

```
// Pattern object
not(equal("}"))
```

```
// Grammar rule
NotCloseBrace = !"}"
```

Input `"x"` at current position succeeds with `undefined`. Input `"}"` fails.

---

### Scan past content until a sentinel

Consume any item that is not a closing brace, repeating until the brace is found
or input is exhausted.

```
// Pattern object
quantifier(
  then([ not(equal("}")), any ])
)
```

```
// Grammar rule
BodyContent = (!"}".)*
```

Input `["a", "b", "}"]` with this pattern (inside a larger sequence that then
consumes `}`) collects `["a", "b"]` before stopping.

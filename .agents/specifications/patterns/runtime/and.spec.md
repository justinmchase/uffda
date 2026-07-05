# And pattern

This chapter defines the logical contract for conjunction-based pattern
matching.

## Logical purpose

The `and` pattern represents conjunction over child patterns. It is intended to
express constraints that are all required for a successful match.

## Behavioral expectations

- An `and` pattern MUST evaluate each of its child patterns against the same
  current matching context.
- The `and` pattern MUST succeed only when every child pattern succeeds.
- If any child pattern fails, the `and` pattern MUST fail.
- Implementations SHOULD preserve failure information that helps identify which
  required condition did not hold.

## Left-recursion behavior

- If any child pattern reports a left-recursion outcome, the `and` pattern MUST
  propagate that outcome unchanged.
- The `and` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- An `and` pattern MUST NOT consume input directly.
- Any input consumption caused by child patterns MUST be governed by those
  child patterns' own contracts.
- When an `and` pattern fails, any consumed input MUST be accounted for by the
  semantics of the child patterns and the matching engine's rollback rules.

## Expected output

- When all child patterns succeed, the `and` pattern MUST report success using
  the output produced by the final child pattern evaluation.
- When an `and` pattern has no child patterns, it MUST succeed as the
  conjunction identity case.
- For the identity case with no child patterns, the reported success output
  MUST be `undefined`.
- When any child pattern fails, the `and` pattern MUST report failure output.

## Error conditions

- The `and` pattern itself does not introduce new error states.
- If any child pattern reports an error, the `and` pattern MUST report that
  error.

## Side effects

- The `and` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `and` pattern SHOULD be used to combine orthogonal constraints into a
  single, declarative matching rule.
- The `and` pattern MAY be composed with sequencing, alternation, traversal, and
  pipeline-oriented patterns to form larger composite behaviors.
- The `and` pattern is a foundational building block and is intended to
  participate in arbitrarily complex pattern structures.

## Examples

### Match a value satisfying two independent constraints

Assert the input item is both a string and matches a lowercase-only regex. Both
constraints are evaluated at the same position; the last child's consumed result
is used.

```
// Pattern object
and([
  type(Type.String),
  regexp(/^[a-z]+$/)
])
```

```
// Grammar rule
LowercaseWord = &type(String) /^[a-z]+$/
```

Input `["hello"]` succeeds with value `"hello"`. Input `[42]` fails at the
`type(String)` check. Input `["Hello"]` fails at the `regexp` check.

---

### Guard a structural match with a type assertion

Use `and` to combine a `type` guard and a structural `over` pattern. The guard
runs first at the same position, failing fast on non-objects before the
structural check runs.

```
// Pattern object
and([
  type(Type.Object),
  over({ kind: equal("literal") })
])
```

```
// Grammar rule
LiteralNode = &type(Object) { kind: "literal" }
```

Input `[{ kind: "literal", value: 42 }]` succeeds. Input `["literal"]` fails
at the `type(Object)` check without attempting the structural match.

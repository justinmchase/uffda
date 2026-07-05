# Reference pattern

This chapter defines the logical contract for named rule indirection and
parameterized rule reuse.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `reference` pattern resolves a named rule, binds declared argument-rule
references to that rule's parameters, and evaluates the resolved rule in the
current matching context according to the
[runtime scope model](../../runtime/scopes.spec.md).

## Behavioral expectations

- A `reference` pattern MUST resolve its target rule name in the current scope.
- Rule resolution and visibility for `reference` MUST follow
  [rule-resolution semantics](../../runtime/scopes.spec.md#rule-resolution-semantics).
- If the target rule cannot be resolved, the `reference` pattern MUST report an
  unknown-reference error.
- The number of supplied argument references MUST equal the target rule's
  parameter count.
- If argument count does not match parameter count, the `reference` pattern
  MUST report an invalid-argument error.
- Each supplied argument reference MUST resolve to an existing rule in scope.
- If any supplied argument reference cannot be resolved, the `reference`
  pattern MUST report an unknown-parameter error.
- A `reference` pattern MUST reject self-reference where an argument resolves to
  the same rule as the reference target.
- If self-reference is detected in arguments, the `reference` pattern MUST
  report an invalid-argument error.
- After successful resolution and binding, the `reference` pattern MUST evaluate
  the resolved rule with the bound parameter-rule arguments in the current
  scope.
- If rule evaluation succeeds, the `reference` pattern MUST succeed.
- If rule evaluation fails, the `reference` pattern MUST fail.
- If rule evaluation reports an error, the `reference` pattern MUST propagate
  that error.

## Left-recursion behavior

- If resolved rule evaluation reports a left-recursion outcome, the
  `reference` pattern MUST propagate that outcome unchanged.
- The `reference` pattern MUST NOT convert a left-recursion outcome into
  failure or success.

## Input consumption

- A `reference` pattern MUST NOT consume input directly.
- A `reference` pattern MUST consume exactly the input consumed by its resolved
  rule evaluation.
- If rule resolution or argument validation fails before evaluation, the
  `reference` pattern MUST report an error without consuming input.

## Expected output

- On success, the `reference` pattern MUST report the resolved rule's matched
  value as its output value.
- On failure, the `reference` pattern MUST report failure output.

## Error conditions

- Unknown rule reference MUST report an unknown-reference error.
- Argument-count mismatch MUST report an invalid-argument error.
- Unknown argument reference MUST report an unknown-parameter error.
- Invalid self-reference argument MUST report an invalid-argument error.

## Side effects

- The `reference` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `reference` pattern SHOULD be used to reuse named rules and express
  parameterized grammar abstractions.
- The `reference` pattern MAY be composed with sequencing, alternation,
  traversal, and pipeline patterns to build modular grammars.

## Examples

### Call a named rule

Delegate to the `Digit` rule defined elsewhere in the same module.

```
// Pattern object
reference("Digit", [])
```

```
// Grammar rule
Number = Digit+
```

Resolution fails if `Digit` is not exported by the current module, producing
an unknown-reference error.

---

### Parameterized rule for a generic list

Pass a rule argument to a generic `ListOf` rule so it can be reused with
different element types.

```
// Pattern object
reference("ListOf", ["Digit"])
```

```
// Grammar rule
DigitList = ListOf<Digit>
```

`ListOf` is defined as `ListOf<T> = T ("," T)*`. Passing `Digit` as the
argument for parameter `T` produces a comma-separated digit list.

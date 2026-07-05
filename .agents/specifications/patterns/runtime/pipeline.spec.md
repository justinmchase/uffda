# Pipeline pattern

This chapter defines the logical contract for staged, value-driven pattern
composition.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `pipeline` pattern runs an ordered sequence of step patterns where each
step receives input derived from the previous step's matched value.

## Behavioral expectations

- A `pipeline` pattern MUST evaluate step patterns in declaration order.
- The first step MUST be evaluated against the current matching input stream.
- Each step after the first MUST be evaluated against a derived input stream
  built from the previous successful step's output value.
- If a step output value is iterable, the derived input stream MUST iterate
  that value directly.
- If a step output value is not iterable, the derived input stream MUST wrap
  that value as a single-item stream.
- If any step fails, the `pipeline` pattern MUST fail.
- If any step reports an error, the `pipeline` pattern MUST propagate that
  error immediately.
- If every step succeeds, the `pipeline` pattern MUST succeed.
- A `pipeline` pattern with no steps MUST succeed and report `undefined`.

## Left-recursion behavior

- If any step reports a left-recursion outcome, the `pipeline` pattern MUST
  propagate that outcome unchanged.
- The `pipeline` pattern MUST NOT convert a left-recursion outcome into failure
  or success.

## Input consumption

- A `pipeline` pattern MUST consume outer input only through its first step.
- Steps after the first MUST consume only their own derived input streams and
  MUST NOT consume additional outer input directly.
- If the first step fails, the `pipeline` pattern MUST fail without consuming
  outer input.
- If a later step fails, the `pipeline` pattern MUST fail without committing
  additional outer-input consumption beyond the first step.
- A `pipeline` pattern with no steps MUST succeed without consuming input.
- A `pipeline` pattern MUST NOT require the final step to consume its derived
  input stream completely unless composed with additional constraints.

## Expected output

- On success with one or more steps, the `pipeline` pattern MUST report the
  final step's matched value as its output value.
- On success with no steps, the `pipeline` pattern MUST report `undefined` as
  its output value.
- On failure, the `pipeline` pattern MUST report failure output.

## Error conditions

- The `pipeline` pattern itself does not introduce new error states.

## Side effects

- The `pipeline` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `pipeline` pattern SHOULD be used for staged transformations where each
  stage consumes the previous stage's output.
- The `pipeline` pattern MAY be nested and composed with sequencing,
  alternation, traversal, and boundary-assertion patterns.

## Examples

### Two-stage tokenize-then-parse pipeline

The first step tokenizes raw characters; the second step parses the resulting
token stream as an expression.

```
// Pattern object
pipeline([
  reference("Tokenizer"),
  reference("Expression")
])
```

```
// Grammar rule
Program = Tokenizer |> Expression
```

Input `"1 + 2"` is consumed by `Tokenizer`, which produces `[1, "+", 2]`.
`Expression` then receives that array as its input and produces an AST.

---

### Numeric transformation pipeline

Apply two successive transformations to a list of numbers: add one to each
element, then double each element.

```
// Pattern object (rules with expressions)
pipeline([
  reference("PlusOne"),   // pattern: any*, expression: map(n => n + 1)
  reference("TimesTwo")   // pattern: any*, expression: map(n => n * 2)
])
```

```
// Grammar rule
Transform = PlusOne |> TimesTwo
```

Input `[1, 2, 3]` produces `[4, 6, 8]` — each element incremented then
doubled.

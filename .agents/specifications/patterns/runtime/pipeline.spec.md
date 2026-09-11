# Pipeline pattern

This chapter defines the logical contract for staged, value-driven pattern
composition.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `pipeline` pattern runs an ordered sequence of step patterns where each step
receives input derived from the previous step's matched value.

## Behavioral expectations

- A `pipeline` pattern MUST evaluate step patterns in declaration order.
- The first step MUST be evaluated against the current matching input stream.
- Each step after the first MUST be evaluated against a derived input stream
  built from the previous successful step's output value.
- The derived input stream for each step after the first MUST use scalar
  normalization and therefore contain exactly one item: the previous step's
  output value.
- A `pipeline` pattern MUST NOT implicitly iterate a step output value, even
  when that value is iterable.
- If any step fails, the `pipeline` pattern MUST fail.
- If any step reports an error, the `pipeline` pattern MUST propagate that error
  immediately.
- If every step succeeds, the `pipeline` pattern MUST succeed.
- A `pipeline` pattern with no steps MUST succeed and report `undefined`.
- Pipeline steps MUST observe variable bindings from the surrounding match scope
  (including captures established before the pipeline). Steps MUST NOT start
  with an empty variable map solely because a pipeline frame was pushed.

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

## Lazy sequence draining at stage boundaries

- A step's matched value MAY be a lazily produced sequence — an actual generator
  or async-generator instance (for example, the result of a std
  `enumerate`/`map`/`filter` call) — rather than an already-materialized array.
- Before such a value is used to build the next step's derived input stream, and
  before source provenance is computed for that step (see
  [Source provenance](#source-provenance) below), the `pipeline` pattern MUST
  drain the generator into a concrete array. This is a stage-boundary
  eager-evaluation point, exactly like array-spread and invocation-spread
  contexts elsewhere in the runtime: laziness is preserved _within_ a single
  step's composition of `map`/`filter`/`enumerate`, but each `|>` boundary is a
  sink.
- This draining MUST reflect back onto the step's reported match value (for
  example, in diagnostic/visualization output), so callers and tooling never
  observe an opaque, already-exhausted generator object where a concrete array
  is expected.
- This draining check MUST be narrow: it MUST detect only actual
  generator/async-generator instances, and MUST NOT trigger merely because a
  value implements `Symbol.iterator`/`Symbol.asyncIterator`. Some domain-shaped
  values (for example, a source-document record) legitimately expose an iterator
  protocol for downstream stream consumption while remaining a plain record that
  MUST NOT be discarded and replaced with an array of its own iterated items.
- Values that are already arrays, or that are not generator instances at all
  (strings, plain objects, `Set`/`Map`, etc.), are unaffected by this draining
  step.

## Source provenance

- When a step output is used to build the next derived input stream, the
  `pipeline` pattern MUST retain reconstructable source provenance from the
  prior step match and parent stream whenever that provenance is available.
- For string outputs, derived streams SHOULD carry a normalization map anchored
  at the prior step's original source span.
- For string-array outputs that represent token streams, derived streams SHOULD
  carry per-item source spans so later failures can resolve to authored offsets.
- Provenance loss at a pipeline step boundary is a contract regression relative
  to the language-layer debuggability requirements unless a higher-authority
  chapter explicitly allows it.

## Composition intent

- The `pipeline` pattern SHOULD be used for staged transformations where each
  stage consumes the previous stage's output.
- When a stage output is iterable and the next stage should consume its items as
  a stream, composition SHOULD use `into` explicitly in that next stage.
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
  into(reference("Expression"))
])
```

```
// Grammar rule
Program = Tokenizer |> into(Expression)
```

Input `"1 + 2"` is consumed by `Tokenizer`, which produces `[1, "+", 2]`. The
next stage receives that array as a scalar item; `into` traverses that array as
a new input stream so `Expression` can consume the token stream and produce an
AST.

---

### Numeric transformation pipeline

Apply two successive transformations to a list of numbers: add one to each
element, then double each element.

```
// Pattern object (rules with expressions)
pipeline([
  reference("PlusOne"),   // pattern: any*, expression: map(n => n + 1)
  into(reference("TimesTwo"))   // pattern: any*, expression: map(n => n * 2)
])
```

```
// Grammar rule
Transform = PlusOne |> into(TimesTwo)
```

Input `[1, 2, 3]` produces `[4, 6, 8]` — each element incremented then doubled.

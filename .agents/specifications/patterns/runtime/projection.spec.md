# Projection pattern

This chapter defines the logical contract for embedding an expression projection
inside a pattern tree.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `projection` pattern matches a child pattern and, on success, evaluates an
expression against that successful match to produce the projection pattern's
output value. It is the runtime mechanism that allows distinct alternatives
(especially under ordered choice) to project different value shapes without
relying on a single rule-level projection.

## Behavioral expectations

- A `projection` pattern MUST evaluate its child pattern against the current
  matching context.
- If the child pattern fails, the `projection` pattern MUST fail.
- If the child pattern reports an error, the `projection` pattern MUST propagate
  that error immediately.
- If the child pattern succeeds, the `projection` pattern MUST evaluate its
  expression against that successful match outcome.
- If expression evaluation completes without throwing, the `projection` pattern
  MUST succeed with the expression result as its output value.
- If expression evaluation throws, the `projection` pattern MUST report a match
  error that preserves expression-exception diagnostics consistent with rule
  projection failures.

## Left-recursion behavior

- A `projection` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `projection` pattern MUST NOT convert a left-recursion outcome into failure
  or success.
- When a `projection` pattern appears inside a directly left-recursive growth
  path, successful child matches that reach expression evaluation MUST
  contribute the projected value to the growth result observed by seed-and-grow
  evaluation. See [runtime left recursion](../../runtime/left-recursion.spec.md)
  and [direct left recursion](../direct-left-recursion.spec.md).

## Input consumption

- A `projection` pattern MUST consume input exactly as its child pattern
  consumes input on success or failure.
- Expression evaluation MUST NOT consume additional matching input.

## Expected output

- On success, the `projection` pattern MUST report the expression result as its
  output value.
- On success, the caller-visible input position and scope MUST advance as
  defined by the successful child match.
- On failure, the `projection` pattern MUST report failure output without
  applying the expression.

## Error conditions

- Expression exceptions during projection MUST surface as match errors with an
  expression-exception class of diagnostic, not as ordinary failure.
- The `projection` pattern MUST NOT introduce additional error classes beyond
  child-propagated errors and expression-exception errors.

## Side effects

- Aside from expression evaluation side effects governed by the expression
  runtime, the `projection` pattern MUST NOT produce externally observable side
  effects beyond its match result and resulting matching context.

## Source provenance

- On success, the `projection` pattern SHOULD retain the successful child match
  span as the projection match span unless a higher-authority chapter defines a
  different provenance mapping for projected values.

## Compositional intent

- Authors SHOULD use nested projection when ordered-choice arms need distinct
  result shapes, especially for direct-left-recursive left-associative AST
  folds.
- Authors SHOULD prefer rule-level projection sugar for whole-body transforms
  that apply to every successful path of a rule.
- Projection MUST remain distinct from `pipeline`, which stages pattern steps on
  prior match values rather than evaluating ExpressionLang.

## Illustrative examples

Member-style DLR with a projected recursive arm (grouped so Uffda depth-0 `->`
remains available for whole-body rule projection):

```text
rule Member =
  (e:Member "." n:Token<Reference> -> { kind: "member", expression: e, name: n.name })
  | Token<MemberTarget>
  ;
```

Whole-body rule projection (group-less) remains valid and SHOULD normalize so
the projected value is visible during matching, including under direct left
recursion when the whole body is projected:

```text
rule NewLine = "\r" "\n" | "\r" | "\n" -> "\n";
```

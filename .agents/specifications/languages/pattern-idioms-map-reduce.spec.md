# Pattern idioms for map and reduce

This chapter documents how grammar authors SHOULD express map- and reduce-style
transforms as pattern matching, instead of collecting values and folding them in
expression projections.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Scope

- This chapter is idiomatic guidance for language-module authoring in `.uff`.
- It does NOT define a new runtime pattern kind or a standard-library `match`
  bridge.
- Related contracts: [pattern layer](./pattern-layer.spec.md),
  [pipeline](../patterns/runtime/pipeline.spec.md),
  [into](../patterns/runtime/into.spec.md),
  [left recursion](../runtime/left-recursion.spec.md).

## Principle

- Iteration over input, discrimination of alternatives, and accumulation of
  match structure MUST belong in the pattern layer when those operations are
  part of recognizing or building grammar structure.
- Rule projections (`-> …`) SHOULD only shape values that patterns have already
  matched and bound.
- Authors MUST NOT move scan, classify, or left-fold work into Native or
  expression loops when an equivalent pattern form exists.

## Map as pattern

Map over a stream is a per-item rule with a projection, repeated by a
quantifier.

### Recipe

1. Define an item rule that matches one element and projects the transformed
   value.
2. Quantify that rule (`Item*`, `Item+`, or an explicit quantifier) and bind the
   collected results when needed.

Illustrative shape:

```text
rule Item =
  …
  -> transform
  ;

rule Items =
  items:Item*
  -> items
  ;
```

### Existing examples

- Morse maps each symbol through projecting letter rules, then aggregates with
  `join`: `x:Symbol+ … -> (join x "")` in `examples/morse/morse.uff`.
- Expression array elements wrap each primary: `ArrayElement` projects an AST
  node, then `e:ArrayInitializer*` collects them in
  `src/lang/expression/array.uff`.
- Character streams use quantified character matches plus specialized std
  aggregators, for example identifier
  `IdentifierStartCharacter IdentifierCharacter* -> (join (flat _) "")` and
  number
  `string & [Digit+] -> { kind: "number", value: (int (join (flat _) "")) }`.

### Anti-pattern

Authors MUST NOT match with a bare quantifier such as `any*` and then apply
Native `.map(…)` (or equivalent expression lambdas) in the projection to perform
the per-item transform. Per-item discrimination and projection belong in the
item rule; the quantifier only repeats it.

## Specialized reduce

When a quantified match has already produced a list (or nested list) and the
fold is a fixed aggregator, projections SHOULD use specialized std functions
rather than a general reduce:

- `flat` — unwrap nested lists from composition
- `join` — concatenate string parts
- `int` — parse a digit string as a number
- `pack` — pack heterogeneous values when needed

These cover common language-module folds without ExpressionLang lambdas or a
general `reduce` builtin.

## Staged transform (pipeline and into)

When a transform is a sequence of whole-value stages, authors SHOULD use
pipeline composition (`P |> Q`).

- Pipeline feeds each stage from the previous stage's **output value**.
- When that output is iterable and the next stage must consume items as a
  stream, the next stage MUST use `into` explicitly (authored as `[P]`).

Example shape from language modules:

```text
rule ExpressionLang =
  Source
  |> [TokenizerNoWhitespace]
  |> [ExpressionComplete]
  ;
```

See [pipeline](../patterns/runtime/pipeline.spec.md) and
[into](../patterns/runtime/into.spec.md).

## General left-fold as direct left recursion

When a grammar builds a left-associative structure from a base and repeated
tails (member chains, binary operator chains, similar AST folds), authors SHOULD
express the fold as direct left recursion (DLR) rather than collecting a segment
list and folding it in a projection.

### Why not collect-then-fold

Collecting `base` + `segments+` and then left-folding in Native/`reduce`
duplicates associativity that patterns can build incrementally. Conversion of
such modules MUST prefer a pattern fold over introducing std `reduce` solely for
that purpose.

### Member example

Instead of matching a base and a list of `.name` segments and folding in
projection, express Member as DLR with a nested projection on the recursive arm.
In Uffda rule declarations, depth-0 `->` is reserved for whole-body rule
projection, so the projected arm MUST be grouped:

```text
rule Member =
  (e:Member "." n:Token<Reference> -> { kind: "member", expression: e, name: n.name })
  | (b:Token<MemberTarget> "." n:Token<Reference> -> { kind: "member", expression: b, name: n.name })
  ;
```

In standalone PatternLang, `P -> E | Q` is also valid because projection binds
more tightly than alternation.

Seed-and-grow DLR builds nested left-associative `member` AST nodes without
expression loops, because each growth step observes the projection result. See
[projection](../patterns/runtime/projection.spec.md) and
[runtime left recursion](../runtime/left-recursion.spec.md).

This requires nested `PatternKind.Projection` in a published CLI (0.1.14+).
Optional `recursive rule` sugar is deferred:
[issue #98](https://github.com/justinmchase/uffda/issues/98).

### Authoring implication

Left-associative AST folds such as `expression/member` SHOULD use DLR with
nested Projection. They MUST NOT wait on ExpressionLang lambda syntax or std
`reduce`. Optional `recursive rule` sugar remains deferred
([issue #98](https://github.com/justinmchase/uffda/issues/98)).

## When expression-side fold may still apply

Expression-level map/filter/reduce MAY still be appropriate when:

- the input is already a produced list value with no natural grammar to
  re-recognize, and
- the transform is a homogeneous value computation rather than AST/associativity
  structure.

Std currently provides `map` and `filter`; ExpressionLang lambda syntax is not
yet author-facing. Those gaps MUST NOT be used to justify collect-then-fold for
Member-style grammar folds.

## Out of scope

- Implementing a standard-library `match` that re-invokes the pattern runtime
  from expressions.
- Implementing std `reduce` or ExpressionLang lambda syntax as prerequisites for
  Member-style left folds.
- Implementing `recursive rule` sugar
  ([issue #98](https://github.com/justinmchase/uffda/issues/98)).
- Changing quantifier semantics.

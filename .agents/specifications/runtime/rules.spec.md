# Runtime rule evaluation

This chapter defines how named rules are evaluated, including packrat
memoization of rule outcomes and the interaction with optional rule-level
projection expressions.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Rule evaluation is the runtime boundary between a named grammar rule and the
pattern (and optional expression) that define it. Callers that resolve a rule
MUST observe a single, reusable success value for a fixed input position,
including any rule-level projection.

## Core contracts

- Rule evaluation MUST match the rule's pattern against the current input under
  a rule stack frame for that rule. The frame records the input the rule was
  entered at, so diagnostics can tell where each enclosing rule began (see
  [match diagnostics](./match-diagnostics.spec.md)).
- When the pattern succeeds and the rule has a projection expression, rule
  evaluation MUST evaluate that expression against the successful pattern match
  and MUST report the expression result as the rule's success value.
- When the pattern succeeds and the rule has no projection expression, the
  rule's success value MUST be the pattern match value.
- When expression evaluation throws, rule evaluation MUST report a match error
  with the expression-exception diagnostic class.

## Memoization

- Rule evaluation MUST memoize outcomes by input position and rule identity
  (including argument specialization).
- A memoized successful outcome MUST store the **caller-visible** success value
  after rule-level projection (when present), not the raw pre-expression pattern
  match value.
- When a later evaluation of the same rule at the same position hits that memo
  entry, it MUST return that same caller-visible success value.
- Alternation backtracking that re-enters a previously successful rule at the
  same position (for example `(R X) | R` after `X` fails) MUST therefore observe
  the projected rule value, not an unprojected pattern intermediate.
- A memo entry MUST be reused only for the input it was computed against. An
  input computed during a match (a later
  [pipeline](../patterns/runtime/pipeline.spec.md) stage's input, or the
  arguments of a func or lambda call) has no positions in common with any other
  input, even one computed at the same position, so its rule outcomes MUST be
  memoized apart from every other input's. Recovery state (whether a recovery
  point was reached; see [error recovery](./error-recovery.spec.md)) is still
  shared by the whole match.
- Positions within one input MUST be distinct: inputs nested inside an item
  ([into](../patterns/runtime/into.spec.md),
  [over](../patterns/runtime/over.spec.md)) MUST extend that item's position, so
  no two of them share a position.

## Left-recursion interaction

- Seed-and-grow left-recursion behavior remains governed by
  [runtime left recursion](./left-recursion.spec.md).
- During growth, recursive memo reads MAY observe intermediate pattern values
  produced by the growth loop. Transforming folds that must reshape each growth
  step MUST use nested [projection](../patterns/runtime/projection.spec.md)
  patterns (or equivalent), not solely a post-grow rule-level expression.
- When growth stabilizes to success, the final caller-visible rule outcome MUST
  still apply any rule-level projection before it is returned and memoized for
  non-growth reuse at that position.

## Error and negative behavior

- Memoization MUST NOT convert a failed or errored pattern outcome into success.
- Expression exceptions during rule-level projection MUST be memoized as errors
  for that position and rule so repeated entry does not re-run a throwing
  expression with divergent diagnostics.

## Composition intent

- Authors MAY write `(R Suffix) | R` (and similar optional-suffix shapes) and
  rely on `R`'s rule-level projection remaining visible on both arms.

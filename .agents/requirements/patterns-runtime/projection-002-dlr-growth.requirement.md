---
id: projection-002
title: DLR growth observes transforming Projection on the recursive Or arm
spec_ref: ".agents/specifications/patterns/runtime/projection.spec.md#left-recursion-behavior; .agents/specifications/patterns/direct-left-recursion.spec.md; .agents/specifications/runtime/left-recursion.spec.md"
---

# Projection Under Direct Left Recursion

## Requirement

Preconditions:

- A single rule R uses ordered choice with a directly left-recursive first arm
  wrapped in a Projection that builds a nested AST node from bound variables,
  and a non-recursive base arm without that Projection.
- R is evaluated through normal runtime rule-resolution flow (seed-and-grow).

Expected behavior:

- R MUST stabilize to a successful fixed point for progressing left-associative
  input.
- Each successful growth step MUST use the Projection expression result as the
  value carried into later growth steps (not the raw child Then/sequence value).
- The final matched value MUST be the nested left-associative structure produced
  by successive Projection applications (Member-shaped).
- A whole-body rule-level projection (`rule R = P -> E`) on a left-recursive
  head MUST apply to every growth step, exactly once per step, so R produces the
  same nested value as `rule R = (P -> E)` and the same value it produces when
  entered as an involved rule of a cycle headed elsewhere.
- Splitting the arms into separate helper rules that re-enter R through another
  rule is indirect left recursion and MUST grow under the same mechanism (see
  `indirect-left-recursion-001`).

Postconditions:

- Member-style DLR folds do not require rule-level-only projection, std
  `reduce`, or ExpressionLang lambdas.
- Authored `.uff` that depends on nested Projection MUST wait until that feature
  ships in a published CLI.
- Successful DLR growth MUST NOT leak rule-local variable bindings into the
  caller scope, and MUST preserve caller bindings the same way non-LR rule
  success does.

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
- Splitting the arms into separate helper rules that re-enter R through another
  rule MUST remain rejected as unsupported indirect left recursion.

Postconditions:

- Member-style DLR folds do not require rule-level-only projection, std
  `reduce`, or ExpressionLang lambdas.
- Authored `.uff` that depends on nested Projection MUST wait until that feature
  ships in a published CLI.
- Successful DLR growth MUST NOT leak rule-local variable bindings into the
  caller scope, and MUST preserve caller bindings the same way non-LR rule
  success does.

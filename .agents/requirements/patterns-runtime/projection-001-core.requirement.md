---
id: projection-001
title: Projection succeeds with the expression result and preserves non-Ok child outcomes
spec_ref: ".agents/specifications/patterns/runtime/projection.spec.md"
---

# Projection Core Semantics

## Requirement

Preconditions:

- A projection pattern with child pattern P and expression E is evaluated at
  position Pos.

Expected behavior:

- Projection MUST evaluate P first.
- If P fails, Projection MUST fail without evaluating E and MUST leave the
  caller-visible position at Pos.
- If P reports an error or left-recursion outcome, Projection MUST propagate
  that outcome unchanged without evaluating E.
- If P succeeds, Projection MUST evaluate E against that successful match.
- If E completes without throwing, Projection MUST succeed with E's result as
  the output value and MUST advance input as P advanced.
- If E throws, Projection MUST report a match error with expression-exception
  diagnostics.

Postconditions:

- Distinct Or arms MAY wrap only some arms in Projection so each arm can produce
  a different value shape.

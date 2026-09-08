---
id: cli-bootstrap-026
title: Member conversion must use DLR with nested Projection
spec_ref: ".agents/specifications/languages/pattern-idioms-map-reduce.spec.md#general-left-fold-as-direct-left-recursion; .agents/specifications/patterns/runtime/projection.spec.md; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/runtime/left-recursion.spec.md"
---

# Member Pattern Left-Fold

## Requirement

Preconditions:

- Nested `PatternKind.Projection` is available in a published CLI (bootstrap
  G0).
- Direct left recursion is supported by the runtime for left-associative
  constructs.
- Pattern idioms for map/reduce prescribe DLR + nested Projection for
  Member-style AST chains.

Expected behavior:

- When `expression/member` is converted to authored `.uff`, the member-chain
  left-fold MUST be expressed as same-rule DLR with a nested projection on the
  recursive arm (or equivalent Projection desugar), not as collecting segments
  and folding them in a projection.
- The converted Member projection MUST NOT use Native `for` / `.reduce`, std
  `reduce`, ExpressionLang lambdas, or a domain-specific fold helper to build
  nested `{ kind: "member", … }` AST nodes.
- Conversion MUST remain blocked until nested Projection is available in a
  **published** CLI (bootstrap G0); it MUST NOT wait on ExpressionLang lambda
  syntax, std `reduce`, or `recursive rule` sugar.

Postconditions:

- Member conversion aligns with conversion gate G3 and blocker B14 as retargeted
  in the module conversion plan.
- Similar left-associative AST folds SHOULD follow the same pattern-fold idiom.

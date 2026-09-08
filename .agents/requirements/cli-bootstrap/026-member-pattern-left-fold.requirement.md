---
id: cli-bootstrap-026
title: Member conversion must use DLR with nested Projection
spec_ref: ".agents/specifications/languages/pattern-idioms-map-reduce.spec.md#general-left-fold-as-direct-left-recursion; .agents/specifications/patterns/runtime/projection.spec.md; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/runtime/left-recursion.spec.md"
---

# Member Pattern Left-Fold

## Requirement

Preconditions:

- Nested `PatternKind.Projection` is available in a published CLI (0.1.14+).
- Direct left recursion is supported by the runtime for left-associative
  constructs.
- Pattern idioms for map/reduce prescribe DLR + nested Projection for
  Member-style AST chains.

Expected behavior:

- `src/lang/expression/member.uff` MUST express the member-chain left-fold as
  same-rule DLR with a nested projection on the recursive arm, for example:
  `(e:Member "." n:Token<Reference> -> { kind: "member", expression: e, name: n.name }) | (b:Token<MemberTarget> "." n:Token<Reference> -> { kind: "member", expression: b, name: n.name })`.
- The Member projection MUST NOT use Native `for` / `.reduce`, std `reduce`,
  ExpressionLang lambdas, or a domain-specific fold helper to build nested
  `{ kind: "member", … }` AST nodes.
- Compiling `member.uff` with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import `./member.uff`; the TypeScript twin is gone.
- Runtime loads Member from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- Member conversion aligns with conversion gate G3 and blocker B14 as closed in
  the module conversion plan.
- Similar left-associative AST folds SHOULD follow the same pattern-fold idiom.

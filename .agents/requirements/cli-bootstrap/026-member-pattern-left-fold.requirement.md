---
id: cli-bootstrap-026
title: Member left-fold must use left recursion through Primary
spec_ref: ".agents/specifications/languages/pattern-idioms-map-reduce.spec.md#general-left-fold-as-left-recursion; .agents/specifications/languages/expression-syntax/member-access.spec.md; .agents/specifications/runtime/left-recursion.spec.md"
---

# Member Pattern Left-Fold

## Requirement

Preconditions:

- Indirect left recursion is supported by the runtime (see
  `indirect-left-recursion-001`).
- Member access projects a named property from any evaluated base expression.

Expected behavior:

- `src/lang/expression/member.uff` MUST express the member-chain left-fold as
  indirect left recursion through `Primary`:
  `e:Token<Primary> "." n:Token<MemberName> -> { kind: "member", expression: e, name: n.name }`,
  where `MemberName` is a `Reference` annotated as a `property` name (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#highlighting)).
- `src/lang/expression/primary.uff` MUST try `Member` before every alternative
  it can extend.
- Member MUST NOT keep a separate hand-maintained list of base forms.
- The Member projection MUST NOT use Native `for` / `.reduce`, std `reduce`,
  ExpressionLang lambdas, or a domain-specific fold helper to build nested
  `{ kind: "member", … }` AST nodes.
- Compiling `member.uff` with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- `a.b.c` parses as `(member (member a b) c)`.
- Member access applies to every primary form, for example `(f x).y`,
  `[1].length`, `{ a: 1 }.a`, and `"abc".length`.
- Similar left-associative AST folds SHOULD follow the same pattern-fold idiom.

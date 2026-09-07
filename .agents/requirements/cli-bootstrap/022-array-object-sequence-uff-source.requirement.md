---
id: cli-bootstrap-022
title: Array, Object, and Sequence expression modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Array / Object / Sequence Uff Sources

## Requirement

Preconditions:

- `tokenizer/token`, `common/spread`, and `expression/reference` are converted
  to `.uff`.
- `expression/primary` may remain TypeScript until later Phase 2 conversions.
- Published CLI PatternLang variable bindings are single-letter identifiers.

Expected behavior:

- `src/lang/expression/array.uff` MUST export `Array` that matches a
  Token-wrapped `[` … `]` of `ArrayInitializer*` (element or spread) and
  projects `{ kind: "array", expressions: e }`.
- `src/lang/expression/object.uff` MUST export `Object` that matches a
  Token-wrapped `{` … `}` of optional `ObjectPairs`, using `(flat _)` to
  assemble pair lists and `(flat (coalesce k []))` to unwrap optional keys, and
  projects `{ kind: "object", keys: … }`. Object pair names MUST use member
  projection `k.name` (not host Native). OpenBrace/CloseBrace MUST NOT use
  `-> "{"` / `-> "}"` projections (published ExpressionLang treats `{` after
  `->` as an object literal).
- `src/lang/expression/sequence.uff` MUST export `Sequence` that matches a
  Token-wrapped `(callee args…)` and projects
  `{ kind: "invocation", expression: e, args: a }`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Array, Object, and Sequence are converted as Phase 2 expression modules.
- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

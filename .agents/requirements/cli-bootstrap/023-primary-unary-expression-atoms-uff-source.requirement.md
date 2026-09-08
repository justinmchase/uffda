---
id: cli-bootstrap-023
title: Primary, Unary, Expression, and Atoms modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Primary / Unary / Expression / Atoms Uff Sources

## Requirement

Preconditions:

- Expression leaves used by Primary (`terminal`, `boolean`, `nullish`, `array`,
  `object`, `sequence`, `number`) are converted; `member`/`string` may remain
  TypeScript until published nested Projection for Member (B14) and B15
  (string).
- `pattern/atoms` has no language-module imports.

Expected behavior:

- `src/lang/expression/primary.uff` MUST export `Primary` as an Or of Sequence,
  Array, Object, Member, Boolean, Nullish, Terminal, and String (identity
  projection).
- `src/lang/expression/unary.uff` MUST export `Unary` as `Not | Primary`.
- `src/lang/expression/expression.uff` MUST export `Expression` as `Unary`.
- `src/lang/pattern/atoms.uff` MUST export `Atoms` as `any|end|ok|fail` keywords
  projecting `{ kind: "any"|"end"|"ok"|"fail" }`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import the `.uff` URLs; TypeScript twins are gone.
- `expression.lang` imports `./expression.uff`; `atomic` imports `./atoms.uff`.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- `expression/member` remains TypeScript until nested Projection ships in a
  published CLI and a DLR + Projection left-fold is validated; MUST NOT wait on
  ExpressionLang lambda literals or std `reduce`.

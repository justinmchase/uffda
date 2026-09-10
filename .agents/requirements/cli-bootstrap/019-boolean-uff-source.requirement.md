---
id: cli-bootstrap-019
title: Boolean expression module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Boolean Uff Source

## Requirement

Preconditions:

- `tokenizer/token` is authored as `.uff`.

Expected behavior:

- `src/lang/expression/boolean.uff` MUST export `Boolean` that matches
  `Token<TrueKeyword>` / `Token<FalseKeyword>` and projects
  `{ kind: "boolean", value: _ }` with keyword rules projecting `true` /
  `false`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Boolean is authored as `.uff`.
- Dependents import `./boolean.uff` (or `../expression/boolean.uff`); the
  TypeScript twin is gone.
- Runtime loads Boolean from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

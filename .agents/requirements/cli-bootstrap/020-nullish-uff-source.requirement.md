---
id: cli-bootstrap-020
title: Nullish expression module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Nullish Uff Source

## Requirement

Preconditions:

- `tokenizer/token` is converted to `.uff`.

Expected behavior:

- `src/lang/expression/nullish.uff` MUST export `Nullish` that matches
  `Token<NullKeyword>` / `Token<UndefinedKeyword>` and projects
  `{ kind: "value", value: _ }` with keyword rules projecting `null` /
  `undefined`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Nullish is converted as a Phase 2 expression leaf.
- Dependents import `./nullish.uff` (or `../expression/nullish.uff`); the
  TypeScript twin is gone.
- Runtime loads Nullish from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

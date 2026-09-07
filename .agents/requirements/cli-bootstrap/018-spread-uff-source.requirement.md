---
id: cli-bootstrap-018
title: Spread language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Spread Uff Source

## Requirement

Preconditions:

- `tokenizer/token` is converted to `.uff`.

Expected behavior:

- `src/lang/common/spread.uff` MUST export `SpreadMarker` as three successive
  `Token<Dot>` matches (where `Dot` equals `"."`).
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Spread is converted as a Phase 1 common helper.
- Dependents import `../common/spread.uff`; the TypeScript twin is gone.
- Runtime loads Spread from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

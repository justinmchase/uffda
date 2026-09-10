---
id: cli-bootstrap-010
title: Combining language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Combining Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.
- The published CLI accepts `\cMn | \cMe | \cMc` character-class syntax.

Expected behavior:

- `src/lang/common/characters/combining.uff` MUST declare and export the
  `Combining` rule using Uffda source syntax (`\cMn | \cMe | \cMc`).
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Combining is authored as `.uff`.
- Dependents import `./combining.uff`; the TypeScript twin is gone.
- Runtime loads Combining from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

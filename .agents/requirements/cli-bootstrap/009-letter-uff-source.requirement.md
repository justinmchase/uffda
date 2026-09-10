---
id: cli-bootstrap-009
title: Letter language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Letter Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.
- The published CLI accepts `\cL | \cNl` character-class syntax.

Expected behavior:

- `src/lang/common/characters/letter.uff` MUST declare and export the `Letter`
  rule using Uffda source syntax (`\cL | \cNl`).
- Compiling that file with the installed Uffda CLI MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Letter is authored as `.uff`.
- Dependents import `./letter.uff` (or equivalent); the TypeScript twin is gone.
- Runtime loads Letter from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

---
id: cli-bootstrap-010
title: Combining language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Combining Uff Source

## Requirement

Preconditions:

- Character-leaf modules convert to `.uff` one at a time after G0–G3 review.
- The published CLI accepts `\cMn | \cMe | \cMc` character-class syntax.

Expected behavior:

- `src/lang/common/characters/combining.uff` MUST declare and export the
  `Combining` rule using Uffda source syntax (`\cMn | \cMe | \cMc`).
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Combining is converted as a Phase 0 character leaf.
- Dependents import `./combining.uff`; the TypeScript twin is gone.
- Runtime loads Combining from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

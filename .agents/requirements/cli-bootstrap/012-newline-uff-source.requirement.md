---
id: cli-bootstrap-012
title: NewLine language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# NewLine Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.
- The published CLI accepts pattern Equal `"\r"` / `"\n"` and expression
  projection `-> "\n"` (B11).

Expected behavior:

- `src/lang/common/characters/newLine.uff` MUST declare and export the `NewLine`
  rule as `"\r" "\n" | "\r" | "\n" -> "\n"`, with no Native projection.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- NewLine is authored as `.uff`.
- Dependents import `./newLine.uff`; the TypeScript twin is gone.
- Runtime loads NewLine from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

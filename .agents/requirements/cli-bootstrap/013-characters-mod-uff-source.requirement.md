---
id: cli-bootstrap-013
title: Characters barrel module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Characters Uff Barrel

## Requirement

Preconditions:

- Phase 0 character leaves are converted to `.uff`.
- The runtime compiler lowers bare `export Name` of an imported name to
  `ExportDeclarationKind.Import`.

Expected behavior:

- `src/lang/common/characters/mod.uff` MUST import and re-export Combining,
  Connecting, Digit, Formatting, Letter, NewLine, and Whitespace from their
  sibling `.uff` modules.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- The Characters barrel is converted; dependents import `./mod.uff`.
- Runtime loads Characters from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

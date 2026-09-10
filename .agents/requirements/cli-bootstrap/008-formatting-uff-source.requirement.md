---
id: cli-bootstrap-008
title: Formatting language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Formatting Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.
- The published CLI accepts `\cCf` character-class syntax.

Expected behavior:

- `src/lang/common/characters/formatting.uff` MUST declare and export the
  `Formatting` rule using Uffda source syntax (`\cCf`).
- Compiling that file with the installed Uffda CLI MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Formatting is authored as `.uff`.
- Dependents import `./formatting.uff` (or equivalent); the TypeScript twin is
  gone.
- Runtime loads Formatting from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

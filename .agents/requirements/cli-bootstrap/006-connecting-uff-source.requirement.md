---
id: cli-bootstrap-006
title: Connecting language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Connecting Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.

Expected behavior:

- `src/lang/common/characters/connecting.uff` MUST declare and export the
  `Connecting` rule using Uffda source syntax (`\cPc`).
- Compiling that file with the Uffda CLI MUST succeed and emit AST JSON under
  `./bin/`.

Postconditions:

- Connecting is authored as `.uff`.
- Dependents import `./connecting.uff` (or equivalent); the TypeScript twin is
  gone.
- Runtime loads Connecting from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

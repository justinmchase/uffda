---
id: cli-bootstrap-030
title: Pattern module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Pattern Uff Source

## Requirement

Preconditions:

- `pattern/or` is authored as `.uff` and exports `Or`.

Expected behavior:

- `src/lang/pattern/pattern.uff` MUST export `Pattern` as identity over `Or`
  (`rule Pattern = Or`).
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Dependents (`prefix`, `structure`, `resolve`, `pattern.lang`) import
  `./pattern.uff`; the TypeScript twin is gone.
- Runtime loads Pattern from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

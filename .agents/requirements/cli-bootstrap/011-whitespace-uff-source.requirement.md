---
id: cli-bootstrap-011
title: Whitespace language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Whitespace Uff Source

## Requirement

Preconditions:

- The published CLI accepts the character-class syntax used by this module.
- The published CLI accepts `\cZs | \cZl | \cZp` character-class syntax and
  string Equal literals such as `"\t"` (B11).

Expected behavior:

- `src/lang/common/characters/whitespace.uff` MUST declare and export the
  `Whitespace` rule using Uffda source syntax (`\cZs | \cZl | \cZp | "\t"`),
  with no Native identity projection.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Whitespace is authored as `.uff`.
- Dependents import `./whitespace.uff`; the TypeScript twin is gone.
- Runtime loads Whitespace from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

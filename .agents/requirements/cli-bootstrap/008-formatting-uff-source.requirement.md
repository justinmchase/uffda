---
id: cli-bootstrap-008
title: Formatting language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Formatting Uff Source

## Requirement

Preconditions:

- Character-leaf modules convert to `.uff` one at a time after G0–G3 review.
- The published CLI accepts `\cCf` character-class syntax.

Expected behavior:

- `src/lang/common/characters/formatting.uff` MUST declare and export the
  `Formatting` rule using Uffda source syntax (`\cCf`).
- Compiling that file with the installed Uffda CLI MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Formatting is converted as a Phase 0 character leaf alongside Digit and
  Connecting.
- Dependents import `./formatting.uff` (or equivalent); the TypeScript twin is
  gone.
- Runtime loads Formatting from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

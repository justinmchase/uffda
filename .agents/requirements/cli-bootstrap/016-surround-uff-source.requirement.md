---
id: cli-bootstrap-016
title: Surround language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Surround Uff Source

## Requirement

Preconditions:

- Published CLI supports rule parameter declaration syntax (`rule Name<P…> =`)
  (B10).

Expected behavior:

- `src/lang/common/surround.uff` MUST declare and export parametric
  `Surround<L, P, R>` with body `L? p:P R?` and projection `-> p`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Surround is converted as a Phase 1 common helper.
- Dependents import `../common/surround.uff`; the TypeScript twin is gone.
- Runtime loads Surround from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

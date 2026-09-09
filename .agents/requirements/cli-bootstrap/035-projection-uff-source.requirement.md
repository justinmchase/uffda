---
id: cli-bootstrap-035
title: Projection module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/pattern-syntax/grammar.spec.md; .agents/specifications/runtime/rules.spec.md#memoization"
---

# Projection Uff Source

## Requirement

Preconditions:

- `pattern/pipe` and `expression/expression` are converted and export `Pipe` /
  `Expression`.
- Runtime rule memoization stores post-expression success values (rules-001), so
  `(Pipe Tail) | Pipe` rematches observe Pipe's projected value.

Expected behavior:

- `src/lang/pattern/projection.uff` MUST export `Projection`.
- Bare `Pipe` and `Pipe -> Expression` MUST be expressed as ordered alternatives
  `(Pipe Tail) | Pipe` with the with-projection arm first (no Native optional
  unwrap, no Maybe/`when` rewrite solely to dodge memo reuse).
- With-projection MUST project
  `{ kind: "projection", pattern: p, expression: t }`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Dependents (`and.uff`) import `./projection.uff`; the TypeScript twin is gone.
- Runtime loads Projection from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

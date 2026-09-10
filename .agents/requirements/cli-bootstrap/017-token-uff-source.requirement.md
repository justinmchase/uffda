---
id: cli-bootstrap-017
title: Token language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Token Uff Source

## Requirement

Preconditions:

- `common/surround` and `common/characters/whitespace` are authored as `.uff`.
- Published CLI supports parametric rule declarations (B10).

Expected behavior:

- `src/lang/tokenizer/token.uff` MUST declare helper `W` as
  `string & [Whitespace*]` and export parametric `Token<P>` as
  `Surround<W, P, W>`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Token is authored as `.uff`.
- Dependents import `../tokenizer/token.uff`; the TypeScript twin is gone.
- Runtime loads Token from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

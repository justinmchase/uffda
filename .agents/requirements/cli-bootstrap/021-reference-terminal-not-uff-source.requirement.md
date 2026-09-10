---
id: cli-bootstrap-021
title: Reference, Terminal, and Not expression modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Reference / Terminal / Not Uff Sources

## Requirement

Preconditions:

- `common/identifier` and `tokenizer/token` are authored as `.uff`.
- `expression/number` and `expression/primary` are authored as `.uff`.

Expected behavior:

- `src/lang/expression/reference.uff` MUST export `Reference` as
  `string & [Identifier] -> { kind: "reference", name: _ }`.
- `src/lang/expression/terminal.uff` MUST export `Terminal` as
  `Token<Number> | Token<Reference> -> _`, importing `./number.uff`.
- `src/lang/expression/not.uff` MUST export `Not` as
  `"not" e:Token<Primary> -> { kind: "not", expression: e }`, importing
  `./primary.uff`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Reference, Terminal, and Not are authored as `.uff`.
- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

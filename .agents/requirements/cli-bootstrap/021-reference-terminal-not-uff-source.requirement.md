---
id: cli-bootstrap-021
title: Reference, Terminal, and Not expression modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Reference / Terminal / Not Uff Sources

## Requirement

Preconditions:

- `common/identifier` and `tokenizer/token` are converted to `.uff`.
- `expression/number` and `expression/primary` may remain TypeScript until later
  Phase 2 conversions.

Expected behavior:

- `src/lang/expression/reference.uff` MUST export `Reference` as
  `string & [Identifier] -> { kind: "reference", name: _ }`.
- `src/lang/expression/terminal.uff` MUST export `Terminal` as
  `Token<Number> | Token<Reference> -> _`, importing `./number.ts` until Number
  is converted.
- `src/lang/expression/not.uff` MUST export `Not` as
  `"not" e:Token<Primary> -> { kind: "not", expression: e }`, importing
  `./primary.uff` (Primary is converted).
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Reference, Terminal, and Not are converted as Phase 2 expression leaves.
- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

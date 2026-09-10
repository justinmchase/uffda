---
id: cli-bootstrap-025
title: SharedRules and Number modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# SharedRules / Number Uff Sources

## Requirement

Preconditions:

- `common/identifier` and `common/characters/digit` are authored as `.uff`.
- Std provides `int` for serializable number projections.

Expected behavior:

- `src/lang/uffda/shared.rules.uff` MUST export `IdentifierToken` as
  `string & (not ReservedKeywordToken) & [Identifier]` and
  `ReservedKeywordToken` as `import|export|rule`.
- `src/lang/expression/number.uff` MUST export `Number` as
  `string & [Digit+] -> { kind: "number", value: (int (join (flat _) "")) }`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

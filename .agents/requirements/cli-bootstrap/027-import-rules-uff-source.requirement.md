---
id: cli-bootstrap-027
title: ImportRules module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# ImportRules Uff Source

## Requirement

Preconditions:

- `uffda/shared.rules` is authored as `.uff` and exports `IdentifierToken`.
- Std provides `join` and `flat` for path and name-list projections (B2).

Expected behavior:

- `src/lang/uffda/import.rules.uff` MUST export `ImportDeclarationSyntax`,
  `ImportNameList`, and `ImportModuleSpecifier`.
- `ImportModuleSpecifier` MUST join quoted path parts with `(join p "")`.
- `ImportNameList` MUST flatten `IdentifierToken IdentifierToken*` with
  `(flat _)`.
- `ImportDeclarationSyntax` MUST project
  `{ kind: "import", moduleUrl: m, names: n }` without Native.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- `uffda.lang` imports `./import.rules.uff`; the TypeScript twin is gone.
- Runtime loads ImportRules from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

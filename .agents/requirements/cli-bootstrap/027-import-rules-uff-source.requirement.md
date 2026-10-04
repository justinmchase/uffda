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
- `ImportModuleSpecifier` MUST project the quoted path through an inner
  `[ModulePath]` rule covering exactly the path text, parsed by
  `ModuleSpecifier` from `src/lang/uffda/specifier.rules.uff` (see
  [module specifiers](../../specifications/languages/uffda-syntax/imports.spec.md#module-specifiers)).
- `ImportNameList` MUST flatten one or more `[ImportedName]`-annotated
  `IdentifierToken` entries with `(flat _)`.
- `ImportDeclarationSyntax` MUST be `[Import]`-annotated and project
  `{ kind: "import", moduleUrl: m, names: n }` without Native (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md)).
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- `uffda.lang` imports `./import.rules.uff`; the TypeScript twin is gone.
- Runtime loads ImportRules from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

---
id: cli-bootstrap-028
title: ExportRules module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/pattern-idioms-map-reduce.spec.md#map-as-pattern; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# ExportRules Uff Source

## Requirement

Preconditions:

- `uffda/shared.rules` is converted and exports `IdentifierToken`.
- `uffda/rule.rules` still provides `RuleDeclarationSyntax` (may remain
  TypeScript).
- Std provides `flat` and `pack`.

Expected behavior:

- `src/lang/uffda/export.rules.uff` MUST export `ExportDeclarationSyntax` and
  `ExportNameList`.
- Standalone exports MUST project each name as `{ kind: "export", name }` in an
  item rule (`ExportName`), then flatten with `(flat _)` — not Native `.map` or
  ExpressionLang lambdas.
- Inline `export rule …` MUST project
  `(pack { kind: "export", name: r.name } r)`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- `uffda.lang` imports `./export.rules.uff`; the TypeScript twin is gone.
- Runtime loads ExportRules from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

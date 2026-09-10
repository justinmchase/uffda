---
id: cli-bootstrap-032
title: RuleRules module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# RuleRules Uff Source

## Requirement

Preconditions:

- `pattern/pattern.lang` and `expression/expression.lang` are authored as `.uff`
  and export `PatternTokens` / `ExpressionTokens`.
- `uffda/shared.rules` exports `IdentifierToken`.
- Std provides `flat`, `pack`, `coalesce`, and `one`.

Expected behavior:

- `src/lang/uffda/rule.rules.uff` MUST export `RuleDeclarationSyntax`,
  `RulePatternBody`, `RuleProjectionExpression`, and the other public rule
  carving helpers previously exported from the TypeScript twin.
- Pattern and projection bodies MUST pipeline into `PatternTokens` and
  `ExpressionTokens` via `|>`.
- Nested chunk rules MUST project with depth-1 `(flat (pack …))` (no Native
  `flat(Infinity)` / `Array.isArray`).
- Optional parameter lists MUST use `(flat (coalesce p []))`. Optional
  projection is a Maybe binding (`j`), so project `j` directly.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- `uffda.lang` and `export.rules.uff` import `./rule.rules.uff`.
- The TypeScript twin is gone; runtime loads RuleRules from `./bin` via `.uff`
  remapping (not `builtInLanguageDeclarations`).

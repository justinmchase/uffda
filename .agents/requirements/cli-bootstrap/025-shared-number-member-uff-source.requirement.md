---
id: cli-bootstrap-025
title: SharedRules and Number modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# SharedRules / Number Uff Sources

## Requirement

Preconditions:

- `common/identifier` and `common/characters/digit` are converted.
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
- `expression/member` remains TypeScript until nested Projection ships in a
  published CLI and a DLR + Projection left-fold is validated for the
  member-chain AST; MUST NOT wait on ExpressionLang lambda literals or std
  `reduce`, and MUST NOT introduce domain-specific fold helpers.
- `expression/string` remains TypeScript until B15 (`"\\"` + object/string
  projection in one module).

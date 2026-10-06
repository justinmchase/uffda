---
id: uffda-language-syntax-003
title: Import, export, and rule declarations each have their own syntax rule
spec_ref: ".agents/specifications/languages/uffda-syntax.spec.md#core-declaration-families"
---

# Declaration Families

## Requirement

Preconditions:

- `src/lang/uffda/` defines the Uffda language.

Expected behavior:

- Imports, exports, and rule declarations MUST each be parsed by a dedicated
  syntax rule (`ImportDeclarationSyntax`, `ExportDeclarationSyntax`,
  `RuleDeclarationSyntax`), so each family can evolve on its own.
- The rule projection tail MUST be exported for reuse by the other declaration
  forms.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/003-carves-out-import-export-and-rule-syntax.requirement.test.ts`.

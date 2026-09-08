---
id: uffda-runtime-compilation-007
title: Bare export of an imported name lowers to Import export kind
spec_ref: ".agents/specifications/languages/uffda-syntax/exports.spec.md#core-contracts; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Re-export Import Kind

## Requirement

Preconditions:

- Uffda syntax AST uses `{ kind: "export", name }` for bare export declarations.
- A module MAY import a name and re-export it without a local rule.

Expected behavior:

- When lowering a syntax module, a bare `export Name` MUST become
  `ExportDeclarationKind.Import` when `Name` is imported and not declared as a
  local rule.
- A bare `export Name` MUST remain `ExportDeclarationKind.Rule` when `Name` is
  declared as a local rule.
- Re-export classification MUST be performed by std `normalizeModule` (not an
  inline Native Set/`map` in the compiler entry projection).

Postconditions:

- Barrel modules such as Characters can re-export `.uff` leaves via `./bin`
  remapping.

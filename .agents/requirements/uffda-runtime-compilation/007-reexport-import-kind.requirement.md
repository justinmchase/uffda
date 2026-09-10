---
id: uffda-runtime-compilation-007
title: Bare export of an imported name lowers to Import export kind
spec_ref: ".agents/specifications/languages/uffda-syntax/exports.spec.md#core-contracts"
---

# Re-export Import Kind

## Requirement

Preconditions:

- Uffda syntax AST uses `{ kind: "export", name }` for bare export declarations.
- A module MAY import a name and re-export it without a local rule.
- Std provides generic `to_set`, `pluck`, `has`, `eq`, `when`, and `not` for
  projection conditionals and membership checks.

Expected behavior:

- When lowering a syntax module, a bare `export Name` MUST become
  `ExportDeclarationKind.Import` when `Name` is imported and not declared as a
  local rule.
- A bare `export Name` MUST remain `ExportDeclarationKind.Rule` when `Name` is
  declared as a local rule.
- Re-export classification MUST run in the authored `runtime.compiler.uff`
  projection pipeline (`NormalizeModule` / inline `NormalizeExport` projection),
  not as a host JS rewrite and not as a domain-specific std helper.

Postconditions:

- Barrel modules such as Characters can re-export `.uff` leaves via `./bin`
  remapping.

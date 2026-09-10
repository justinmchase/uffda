---
id: modules-runtime-004
title: Func declarations resolve, export, import, and invoke with std shadowing
spec_ref: ".agents/specifications/modules.spec.md; .agents/specifications/languages/uffda-syntax/func-declarations.spec.md"
---

# Func Module Resolution And Invocation

## Requirement

Preconditions:

- Runtime `ModuleDeclaration` supports `funcs` and `ExportDeclarationKind.Func`.

Expected behavior:

- A module that declares and exports a func MUST expose that func on
  `module.exports` and allow expression invocation `(Name arg…)` from a rule
  projection in the same module.
- Importing an exported func into another module MUST bind the name for
  invocation; the imported func MUST shadow a same-named std global.
- Importing a name that collides with a local `func` or local `rule` MUST fail
  module resolution.
- Exporting an unknown func name MUST fail module resolution.

Postconditions:

- Author funcs are ordinary callables (not match-aware).

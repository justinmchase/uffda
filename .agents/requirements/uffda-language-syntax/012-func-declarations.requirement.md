---
id: uffda-language-syntax-012
title: Func declarations parse and lower to ModuleDeclaration.funcs
spec_ref: ".agents/specifications/languages/uffda-syntax/func-declarations.spec.md; .agents/specifications/modules.spec.md#module-declaration-model"
---

# Func Declaration Parse And Lower

## Requirement

Preconditions:

- In-tree UffdaLang and runtime.compiler include `func` / `export func` after
  `compile:lang` (workspace `./bin`).
- ExpressionLang can parse expression bodies used in func declarations.

Expected behavior:

- Source `func Double<a> = (add a a);` MUST parse and lower to a
  `ModuleDeclaration` whose `funcs` list contains one entry named `Double` with
  one parameter `a` and an invocation expression body.
- Source `export func Id<a> = a;` MUST lower with both an export of `Id` (func
  kind after finalize) and a matching `funcs` entry.
- `export Id; func Id<a> = a;` MUST lower equivalently to
  `export func Id<a> = a;`.

Postconditions:

- Language modules under `src/lang/` still MUST NOT author `func` until a
  published CLI includes this surface.

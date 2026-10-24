---
id: cli-bootstrap-033
title: UffdaLang module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# UffdaLang Uff Source

## Requirement

Preconditions:

- `uffda/import.rules`, `uffda/export.rules`, and `uffda/rule.rules` are
  authored as `.uff`.
- Std provides `flat`.

Expected behavior:

- `src/lang/uffda/uffda.lang.uff` MUST export `UffdaLang`.
- `ModuleBody` MUST collect `ImportDeclarationSyntax*`,
  `ExportDeclarationSyntax*`, and `RuleDeclarationSyntax*`, then project
  `{ kind: "module", declarations: (flat [i (flat e) r]) }` (export items may
  already be lists).
- `UffdaLang` MUST pipeline `Source |> [TokenizerNoWhitespace] |> [ModuleBody]`
  and require `end`.
- Rust language execution MUST load the compiled `uffda.lang.uff` declaration
  without a TypeScript grammar wrapper or ModuleDeclaration twin.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Runtime loads UffdaLang from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

## Test plan

- `rust/src/lang_tests/uffda.rs`

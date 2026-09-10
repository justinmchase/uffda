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
- `src/lang/uffda/uffda.lang.ts` MUST remain only as the `uffdaGrammar` helper
  (and execute/compiler re-exports) pointed at `./uffda.lang.uff` — no
  ModuleDeclaration twin.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Runtime loads UffdaLang from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

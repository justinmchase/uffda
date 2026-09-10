---
id: cli-bootstrap-039
title: Tokenizer language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/tokenization.spec.md"
---

# Tokenizer Uff Source

## Requirement

Preconditions:

- Published CLI includes B2 (`flat`/`join`), B7
  (`semantic_no_whitespace_texts`), and B15 multi-rule `"\\"` scanning
  (0.1.24+).
- `common/characters/mod` and `tokenizer/token` are converted to `.uff`.

Expected behavior:

- `src/lang/tokenizer/mod.uff` MUST declare structured token rules and export
  `Tokenizer`, `TokenizerNoWhitespace`, and re-export `Token`.
- `TokenizerNoWhitespace` MUST project via `(semantic_no_whitespace_texts _)`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Tokenizer is converted as Phase 5 module #45.
- Dependents import `../tokenizer/mod.uff`; the TypeScript ModuleDeclaration
  twin is gone.
- Runtime loads Tokenizer from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- Host `structured.ts` MAY remain for TypeScript type guards and span helpers.

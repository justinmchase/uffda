---
id: cli-bootstrap-041
title: TokenizerLang language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/tokenization.spec.md#semantic-token-text-helpers-bootstrap-precursors"
---

# TokenizerLang Uff Source

## Requirement

Preconditions:

- `source/mod` and `tokenizer/mod` are converted to `.uff`.
- Published CLI includes B7 `semantic_texts` (0.1.24+).

Expected behavior:

- `src/lang/tokenizer/tokenizer.lang.uff` MUST export `TokenizerLang` as
  `s:Source |> [Tokenizer] -> { source: s, tokens: (semantic_texts _) }`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- TokenizerLang is converted as Phase 5 module #48.
- Dependents import `tokenizer.lang.uff`; the ModuleDeclaration twin is gone.
- Host `tokenizer.lang.ts` MAY remain for the `TokenizerLangValue` type only.

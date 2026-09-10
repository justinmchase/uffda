---
id: cli-bootstrap-024
title: ExpressionLang and Atomic modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# ExpressionLang / Atomic Uff Sources

## Requirement

Preconditions:

- `expression/expression` is authored as `.uff`.
- `pattern/atoms` is authored as `.uff`; Atomic imports authored `.uff` for
  `literals`, `resolve`, and `structure`.
- `source/mod` and `tokenizer/mod` are authored as `.uff`.

Expected behavior:

- `src/lang/expression/expression.lang.uff` MUST export `ExpressionLang` as a
  pipeline `Source |> [TokenizerNoWhitespace] |> [ExpressionComplete]`, and
  `ExpressionTokens` as `[ExpressionComplete]`. `ExpressionComplete` MUST bind
  with a single-letter variable (`e:Expression end -> e`) until B12.
- `src/lang/expression/expression.lang.ts` MUST remain only as a host helper
  (`expressionGrammar`) that loads `./expression.lang.uff` from `./bin` — not as
  a ModuleDeclaration twin registered in `builtInLanguageDeclarations`.
- `src/lang/pattern/atomic.uff` MUST export `Atomic` as
  `Atoms | Literals | Resolve | Structure`.
- Compiling those `.uff` files with the bootstrap compile path MUST succeed and
  emit AST JSON under `./bin/`.

Postconditions:

- Dependents import `.uff` URLs for ExpressionTokens/Atomic.
- Runtime loads ExpressionLang/Atomic from `./bin` via `.uff` remapping.

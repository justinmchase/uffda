---
id: cli-bootstrap-031
title: PatternLang module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# PatternLang Uff Source

## Requirement

Preconditions:

- `pattern/pattern` is authored as `.uff`.
- `expression/expression.lang` already demonstrates the Source → tokenize →
  complete pipeline shape in `.uff`.

Expected behavior:

- `src/lang/pattern/pattern.lang.uff` MUST export `PatternLang` and
  `PatternTokens`.
- `PatternComplete` MUST be `p:Pattern end -> p`.
- `PatternTokens` MUST be `[PatternComplete]`.
- `PatternLang` MUST pipeline
  `Source |> [TokenizerNoWhitespace] |> [PatternComplete]`.
- `src/lang/pattern/pattern.lang.ts` MUST remain only as the `patternGrammar`
  helper pointed at `./pattern.lang.uff` (no ModuleDeclaration twin).
- Compiling `pattern.lang.uff` with the bootstrap compile path MUST succeed and
  emit AST JSON under `./bin/`.

Postconditions:

- `uffda/rule.rules` imports `../pattern/pattern.lang.uff` for `PatternTokens`.
- Runtime loads PatternLang from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).

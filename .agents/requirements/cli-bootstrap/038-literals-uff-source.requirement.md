---
id: cli-bootstrap-038
title: Literals and CharacterClass modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/pattern-syntax/string-literals.spec.md"
---

# Literals / CharacterClass Uff Source

## Requirement

Preconditions:

- Expression `number`, `boolean`, and `nullish` modules are converted.
- `common/identifier` is converted.
- ValueSource tagging (B17), string escapes (B11/B15), and `join`/`flat`/`pack`
  std helpers are available.

Expected behavior:

- `src/lang/pattern/character_class.uff` MUST export `CharacterClass` as an Or
  of `\c…` token pairs projecting `{ kind: "character", characterClass }` with
  abbreviation strings (e.g. `"Nd"`). Arms MUST use Equal tokens, not
  Digit-style `\cNd` match sugar.
- `src/lang/pattern/literals.uff` MUST export `Literals` covering type keywords,
  character classes, between (closed then open-upper then open-lower), includes,
  and bare equal. Projections MUST be serializable (no `ExpressionKind.Native`).
- `src/lang/pattern/atomic.uff` MUST import `./literals.uff` (not a TypeScript
  twin).
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- TypeScript twin `literals.ts` is gone.
- Conversion-plan module 28 is done; `builtInLanguageDeclarations` MUST NOT
  register literals.

---
id: cli-distribution-007
title: The JSR package exposes generic grammar parsing and AST-lowering APIs
spec_ref: ".agents/specifications/languages.spec.md#public-grammar-apis; .agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract"
---

# JSR Public Grammar APIs

## Requirement

Preconditions:

- The package is imported from JSR using its declared TypeScript exports.
- A caller supplies a grammar module URL and entry rule to `parseGrammar`.

Expected behavior:

- `deno.jsonc` MUST export the generic grammar API, tokenizer grammar API,
  pattern grammar API, expression grammar API, Uffda grammar/compiler API, and
  language metadata API as supported subpaths.
- `parseGrammar<TAst>` MUST return the match for the named entry rule as
  `Match<TAst>`, allowing a caller's grammar to project its own AST.
- `GrammarOptions` MUST allow a caller to set the resolver's artifact layout,
  import map, and package resolver. Unspecified resolver options MUST retain
  existing defaults, including built-in language declarations and globals.
- `patternGrammar` and `expressionGrammar` MUST continue to return lowered
  runtime `Pattern` and `Expression` values in their match results.
- `tokenizerGrammar` MUST return the tokenizer language result, including its
  normalized source and parser-compatible token text iterable.
- The `/pattern` and `/expression` `.uff` modules MUST export their raw
  token-level `Pattern` and `Expression` rules in addition to the complete
  language entry points.
- The package MUST provide dedicated `/pattern-syntax` and `/expression-syntax`
  `.uff` aliases for those raw grammar component modules.
- The package MUST provide a `/source` `.uff` alias for the source-normalizing
  grammar module.
- The TypeScript `/pattern` and `/expression` entry points MUST export
  `PatternKind` and `ExpressionKind`, respectively.
- The `/runtime` TypeScript entry point MUST export `match`, `Scope`, `Pattern`,
  `Expression`, and the pattern/expression kind enums.
- The `/pattern` and `/expression` TypeScript entry points MUST re-export their
  respective runtime AST types.
- `readLanguageMetadata` MUST remain available for validating the raw metadata
  value declared by a language's `Language` decorator.

Postconditions:

- A downstream grammar can parse and lower to its own AST through the public API
  without adding application-specific semantics to Uffda.
- Tests: `src/lang/grammar.test.ts`,
  `src/lang/tokenizer/tokenizer.lang.test.ts`,
  `test/integration/cli-distribution-007-jsr-public-grammar-apis.requirement.test.ts`.

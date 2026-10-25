---
id: cli-distribution-007
title: JSR root is a Rust cutover stub; .uff grammar remports remain via uffda.jsonc
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract; .agents/specifications/languages.spec.md#public-grammar-apis"
---

# JSR Cutover Stub and Grammar Remports

## Requirement

Preconditions:

- The package is imported from JSR using its declared TypeScript exports and/or
  Uffda `jsr:@justinmchase/uffda/<export>` grammar imports.

Expected behavior:

- `deno.jsonc` MUST export only `"."` → `./mod.ts`.
- `mod.ts` MUST export string constants that state the runtime/CLI moved to the
  Rust `uffda` binary, TypeScript library subpaths are withdrawn from JSR, and
  compiled grammar artifacts remain under `./bin` for remport.
- `deno.jsonc` MUST NOT declare TypeScript subpath exports for `./grammar`,
  `./runtime`, `./tokenizer`, `./pattern`, `./expression`, `./uffda`, or
  `./language-metadata`.
- The package MUST still provide dedicated `/pattern-syntax`,
  `/expression-syntax`, and `/source` `.uff` aliases (and the other
  `uffda.jsonc` grammar exports) so remported grammars compose as before (see
  cli-distribution-006).
- The retired Deno runtime and TypeScript grammar wrappers under `src/` MUST NOT
  be required for grammar resolution or execution.

Postconditions:

- `import "jsr:@justinmchase/uffda@^x/pattern-syntax" Pattern` (and sibling
  grammar exports) still resolve through the published package.
- `import { parseGrammar } from "jsr:@justinmchase/uffda/grammar"` is not a
  supported published import after cutover.
- Tests: `src/resolver/packages/tests.rs`,
  `src/cli/requirement_ports.rs`.

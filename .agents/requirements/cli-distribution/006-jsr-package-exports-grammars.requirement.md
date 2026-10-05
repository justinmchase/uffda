---
id: cli-distribution-006
title: The JSR package exports its grammars through uffda.jsonc and ships their compiled artifacts
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract"
---

# JSR Package Grammars

## Requirement

Preconditions:

- The Publish workflow compiles `./bin` (`deno task compile:lang`) and publishes
  the repository to JSR as `@justinmchase/uffda`.

Expected behavior:

- The repository root MUST hold a valid `uffda.jsonc` whose `exports` maps
  `./tokenizer` to `./src/lang/tokenizer/mod.uff`, with the default `./bin`
  output directory.
- `publish.exclude` MUST keep `uffda.jsonc` and `bin/` in the package.
- A consumer's `import "jsr:@justinmchase/uffda@<range>/tokenizer" Tokenizer;`
  MUST resolve, through `JsrPackages`, to the compiled tokenizer and every
  module it imports, with no file the package does not ship.

Postconditions:

- Grammars written against the published package can use its tokenizer.
- Tests:
  `test/integration/cli-distribution-006-jsr-package-grammars.requirement.test.ts`
  (serves the repository's own `uffda.jsonc` and `bin/` as a package from a fake
  registry and tokenizes text with the imported rule).

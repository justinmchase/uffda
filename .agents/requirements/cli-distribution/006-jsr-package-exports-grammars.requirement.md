---
id: cli-distribution-006
title: The JSR package exports reusable .uff grammars and ships their compiled artifacts
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract"
---

# JSR Package Grammars

## Requirement

Preconditions:

- The Publish workflow compiles `./bin` (`deno task compile:lang`) and publishes
  the repository to JSR as `@justinmchase/uffda`.

Expected behavior:

- The repository root MUST hold a valid `uffda.jsonc` whose `exports` maps
  `./tokenizer`, `./tokenizer-lang`, `./pattern`, `./expression`, `./imports`,
  `./exports`, and `./language` to their corresponding `.uff` source modules
  under `./src/lang/`, with the default `./bin` output directory.
- `publish.exclude` MUST keep `uffda.jsonc` and `bin/` in the package.
- A consumer's Uffda imports of each listed package export MUST resolve, through
  `JsrPackages`, to the compiled module and every module it imports, with no
  file the package does not ship.
- The built-in languages' own `.uff` artifacts MUST load when the uffda package
  root is non-`file:` (for example an
  `https://jsr.io/@justinmchase/uffda/<version>/` root a consumer imports
  `jsr:@justinmchase/uffda` from), fetched over the network rather than
  requiring a local `file:` copy
  ([#271](https://github.com/justinmchase/uffda/issues/271)).

Postconditions:

- Grammars written against the published package can reuse its tokenization,
  pattern, expression, import/export syntax, and language modules.
- Resolving the package's grammars (including validating its `uffda.jsonc`
  through the built-in module-specifier grammar) does not require a repository
  checkout; the built-in `.uff` artifacts load from the package wherever it is
  served.
- Tests:
  `test/integration/cli-distribution-006-jsr-package-grammars.requirement.test.ts`
  (serves the repository's own `uffda.jsonc` and `bin/` as a package from a fake
  registry and resolves each exported grammar), and
  `src/runtime/resolvers/uff.artifact.resolver.test.ts` (loads a built-in
  artifact from an `https:` package root over a stubbed network fetch).

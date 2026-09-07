---
id: cli-bootstrap-015
title: Published CLI embeds ./bin AST JSON via deno compile --include
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#bootstrap-definition"
---

# Embed Bin Artifacts In Standalone CLI

## Requirement

Preconditions:

- Converted language modules exist as authored `.uff` under `src/lang/`.
- `compile:lang` produces mirrored AST JSON under `./bin/`.

Expected behavior:

- `deno task compile:cli` MUST run `compile:lang` before `deno compile`.
- `scripts/compile-cli.ts` MUST pass `deno compile --include ./bin` so the
  compiled AST JSON files are embedded in each published CLI binary.
- `.github/workflows/release-binaries.yml` MUST compile language modules into
  `./bin` and pass the same `--include ./bin` when building release assets
  (release CI must not bypass `compile-cli.ts` without the include).
- Standalone grammar loading MUST remap logical `.uff` URLs using the binary
  extract root’s embedded `./bin` (not the consumer process cwd).
- In-tree runs MUST continue remapping against the workspace `./bin` after
  `compile:lang`.
- Until a release that includes `--include ./bin` is published and verified,
  Checks and release bootstrap compile MUST pin to the last working published
  CLI (currently `0.1.7`).

Postconditions:

- Published CLI binaries compile authored `.uff` using embedded `./bin` JSON.
- Converted modules stay off `builtInLanguageDeclarations` (no host twins).

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
- When attaching release assets, the workflow MUST download only CLI target
  artifacts (`uffda-*`) and MUST NOT upload the language `./bin` tree to the
  GitHub Release.
- Standalone grammar loading MUST remap logical `.uff` URLs using the binary
  extract root’s embedded `./bin` (not the consumer process cwd).
- In-tree runs MUST continue remapping against the workspace `./bin` after
  `compile:lang`.
- Checks and release bootstrap compile MUST install a published CLI via
  `uffda-setup` (normally `latest`; pin a SemVer only when recovering from a bad
  release).

Postconditions:

- Published CLI binaries compile authored `.uff` using embedded `./bin` JSON.
- Converted modules stay off `builtInLanguageDeclarations` (no host twins).

---
id: cli-distribution-005
title: JSR publish ships only the stub, uffda.jsonc, .uff sources, and bin/
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract"
---

# JSR Publish Package Contents

## Requirement

Preconditions:

- The package is published to JSR from `deno.jsonc` via `npx jsr publish`.

Expected behavior:

- `deno.jsonc` MUST restrict the published file set so the package contains the
  cutover stub (`mod.ts`), `uffda.jsonc`, `README.md`, `src/lang/**/*.uff`, and
  `bin/` (compiled ModuleDeclarations), and MUST NOT ship `.agents/`,
  `.cursor/`, `.github/`, Rust workspace crates under `src/`, and retired implementation TypeScript
  (other than `.uff` sources), `src/requirements/`, `editors/`, or test trees.
- Those excluded trees MUST NOT appear in the JSR package file list produced by
  `npx jsr publish --dry-run`.
- The exclusion exists so agent/requirement paths with long filenames cannot
  break the JSR tarball verify step, and so publish uploads stay small enough
  for reliable JSR provenance.

Postconditions:

- Real JSR publishes succeed without shipping in-repo agent docs, Rust sources,
  or the Deno TypeScript library graph.
- Grammar consumers still receive `uffda.jsonc` + `.uff` + `bin/`.
- Tests: `src/cli/requirement_ports.rs` (asserts publish include/exclude
  entries). JSR `--dry-run` file-list verification remains a Publish workflow
  step.

---
id: cli-distribution-005
title: JSR publish excludes agent docs and requirement trees
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#jsr-package-contract"
---

# JSR Publish Path Exclusions

## Requirement

Preconditions:

- The package is published to JSR from `deno.jsonc` via `npx jsr publish` /
  `deno publish`.

Expected behavior:

- `deno.jsonc` MUST declare `publish.exclude` entries for `.agents/`,
  `.cursor/`, `.github/`, and `src/requirements/`.
- Those trees MUST NOT appear in the JSR package file list produced by
  `npx jsr publish --dry-run`.
- The exclusion exists so agent/requirement paths with long filenames cannot
  break the JSR tarball verify step (`File … not found in the tarball` after
  ustar path truncation).

Postconditions:

- Real JSR publishes succeed without shipping in-repo agent docs or requirement
  tests.
- Library consumers still receive the `mod.ts` export graph.

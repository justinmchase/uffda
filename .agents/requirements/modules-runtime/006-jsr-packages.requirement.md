---
id: modules-runtime-006
title: "jsr: modules load from JSR packages through the lockfile, verified and cached"
spec_ref: ".agents/specifications/modules.spec.md#packages"
---

# JSR Packages

## Requirement

Preconditions:

- A module imports a `jsr:@scope/name@range/export` specifier, written in full
  or through the project's import map, and the `Resolver` has a package resolver
  (`ResolverOptions.packages`, an `IPackageResolver`).

Expected behavior:

- `JsrPackages` (`src/packages/jsr_packages.ts`) MUST choose the version the
  lockfile records for `jsr:@scope/name@range`; else the highest version it
  already chose for the package that satisfies the range; else the highest
  non-yanked version in `https://jsr.io/@scope/name/meta.json` satisfying the
  range (`*` without one, so no prereleases). It records the choice in the
  lockfile.
- It MUST read `<version>_meta.json`, check its sha256 against the lockfile's
  integrity for `@scope/name@version` when there is one and record it when not,
  and verify every other file it reads against the manifest's `sha256-`
  checksum. A file the manifest does not list fails.
- It MUST map the export name (`.` or `./<export>`) through the package
  version's `uffda.jsonc` (read with `parseProject`) to a `.uff` path, and
  resolve the specifier to `https://jsr.io/@scope/name/<version>/<path>`. The
  `Resolver` MUST key the module, and its import chain frame's `resolvedUrl`, by
  that URL, so two specifiers choosing the same file are one module.
- Loading that URL MUST read `<outDir>/ast/<path>.uffda.ast.json` within the
  package version, with `outDir` from its `uffda.jsonc`. A URL in a package that
  is not a `.uff` file fails.
- In a package's module, an import of a module name MUST fail, and a relative
  import that resolves outside its package version MUST fail.
- Files MUST be cached under `<cache>/uffda/jsr/<registry path>`
  (`uffdaCacheDir` in `src/packages/cache_dir.ts`: `XDG_CACHE_HOME`, else
  `LOCALAPPDATA`, else `$HOME/.cache`). A cached file that fails its checksum is
  downloaded again. `meta.json` is fetched afresh and read from the cache only
  when fetching fails.
- `commandProject` (`src/cli/command_project.ts`) MUST supply a `JsrPackages`
  over `uffda.lock` beside the project file (`Lockfile` in
  `src/packages/lockfile.ts`), or over an in-memory lockfile without a project,
  to `run`, `exec`, MCP sessions and the language server. An invalid lockfile
  fails as an invalid project file does (the language server logs it).
- Without a package resolver, a `jsr:` import MUST fail with
  `Unable to load <url>: no package resolver is configured`.
- Every failure MUST be a module-resolution error
  `Unable to load <specifier or URL>: <reason>`.
- The compiled CLI MUST be allowed `--allow-net=jsr.io` and to read `HOME`,
  `XDG_CACHE_HOME` and `LOCALAPPDATA`.

Postconditions:

- A package's consumers load its compiled modules from its project file alone;
  the lockfile reproduces the same versions and bytes on every checkout.
- Tests: `src/packages/jsr_packages.test.ts`,
  `src/packages/jsr_specifier.test.ts`, `src/packages/lockfile.test.ts`,
  `src/packages/cache_dir.test.ts`, `src/runtime/resolve.test.ts` (RESOLVE11,
  RESOLVE13), `src/cli/command_project.test.ts`, `src/cli/exec.test.ts`,
  `src/cli/mcp.session.test.ts`, `src/cli/lsp.documents.test.ts`,
  `src/cli/distribution.test.ts`.

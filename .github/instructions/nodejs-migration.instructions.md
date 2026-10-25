---
description: "Use when migrating repository helpers from Deno to Node.js, moving the Rust workspace into src, or updating the associated tasks, tests, CI and agent instructions."
---

# Rust layout and Node.js tooling migration

This is the approved and implemented migration. Keep repository paths, Node.js
tooling, tests, CI and release instructions consistent with this state.

## Scope and boundaries

- Production runtime and CLI remain Rust. Node.js replaces repository scripting,
  tests and tooling, not the runtime.
- Preserve authored grammars under `src/lang/` and independent compatibility
  fixtures under `test/rust/`. Do not recreate the retired TypeScript runtime.
- Retain root `deno.jsonc`, `deno.lock` and `mod.ts` for the JSR package only.
  Remove `tasks`, `imports`, `fmt` and `lint` from `deno.jsonc`; preserve
  package identity, exports and publish configuration.
- Development, tests, formatting and linting must not require Deno. Use
  `npx jsr publish` for the retained JSR publishing surface, validating its
  configuration and package contents before changing the release workflow.
- Do not rename historical fixtures, rewrite historical benchmark artifacts or
  remove a Rust dependency just because its name contains `deno`. Investigate
  actual runtime dependencies and preserve package/version semantics.
- Do not edit attached snapshots; edit the repository's real files.

## Rust layout

Avoid the accidental nested layout `src/src/`.

| Current location                                                       | Target location                               |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `rust/Cargo.toml`, `rust/Cargo.lock`, `rust/build.rs`                  | Repository root                               |
| `rust/src/*`                                                           | `src/*`, preserving existing `src/lang/`      |
| `rust/codec`, `rust/heap`, `rust/build`, `rust/xtask`, `rust/consumer` | Corresponding directories under `src/`        |
| `rust/tests/*`                                                         | Root `tests/`                                 |
| Rust files under `rust/examples/`                                      | Root `examples/`, preserving grammar examples |

Inventory collisions before moving files. Preserve crate names, public APIs,
features, version pins, package contents and runtime behavior. Keep generated
targets out of source control; no need to move build caches.

Update every affected manifest path, workspace member, Cargo alias, build-script
root lookup, `include!` path, fixture path, embedded-artifact path, package
include/exclude pattern, version hook and publication step. Also update scripts,
tests, workflows, editor settings, documentation and agent instructions.
`CARGO_MANIFEST_DIR` changes must be checked explicitly; bulk path replacement
alone is not sufficient.

## Node.js conventions

- Use ESM TypeScript executed with Node.js. Python remains prohibited, including
  one-liners and GitHub Actions. Shell may orchestrate tools; non-trivial
  scripting logic belongs in TypeScript on Node.js.
- Use a supported Node.js LTS version consistently in local tooling and CI.
  Prefer Node's native TypeScript execution when supported by that version and
  syntax; otherwise use one explicit runner such as `tsx`.
- Manage root helper dependencies and scripts in `package.json` with a committed
  `package-lock.json`; use `npm ci` in CI. Keep the VS Code extension's existing
  independent package boundary unless a concrete migration need requires more.
- Use `node:` built-ins and Web Platform APIs. Replace `Deno.*`, JSR standard
  library imports and Deno import-map resolution in executable helpers.
- Port tests to `node:test` and `node:assert/strict`, preserving assertions,
  coverage and failure cases. Keep `.test.ts` naming. Include performance-tool
  tests in an explicit test command rather than silently omitting them.
- Add a TypeScript type-check command; executing TypeScript is not type
  checking.
- Preserve subprocess exit codes, signals, stdout/stderr handling, environment
  isolation, temporary-directory cleanup and cross-platform path behavior. Do
  not replace subprocess failures with successful-looking fallbacks.
- Port compression, filesystem, timing and process APIs by behavior, not just
  names. Validate roundtrips and measurement boundaries; do not rewrite a
  historical baseline to hide changes in compression output or methodology.

## Tasks, formatting and CI

- Replace the existing Deno task surface with npm scripts covering CLI
  execution, language bootstrap, optimized CLI builds, helper tests, Rust tests,
  grammar formatting and preflight checks. Retain familiar task names where
  practical.
- Use Prettier for supported text formats and ESLint for TypeScript helpers.
  Define write/check commands and excludes for generated artifacts, targets,
  scratch files and separately managed packages. Do not introduce unrelated
  repository-wide formatting churn.
- Rust remains formatted/linted/tested with Cargo, rustfmt and Clippy. `.uff`
  files remain formatted by the in-tree Uffda formatter.
- Replace Deno setup, commands and action metadata in Checks, publishing,
  release/setup helpers, benchmark workflows and local tooling. Test Node.js
  helpers on every operating system they claim to support.
- Update `AGENTS.md`, Copilot instructions and Cursor rules consistently: use
  Node.js rather than Deno for scripting, dependencies and validation. Remove
  contradictory Deno-only guidance; do not leave two competing conventions.
- Update active contributor docs and commands. Label historical Deno evidence as
  historical instead of changing the meaning of recorded results.

## Bootstrap and release invariants

- Language bootstrap remains a single previous-published
  `uffda compile 'src/lang/**/*.uff'`, preceded only by clearing the known
  workspace `bin/` directory. Never use an in-tree compiler to seed an empty
  artifact tree.
- Embed and resolve the emitted `.uff.ast` declarations directly. Never seed
  compiler artifacts under source, re-lower imports or post-process `bin/`.
- Serialize artifact regeneration against Cargo builds/tests that embed it.
- Preserve JSON compatibility siblings and JSR package exports.
- Preserve the six-platform build/standalone acceptance matrix, checksums,
  installers, crate publication order and Trusted Publishing settings.
- Never create or move release tags, publish packages or bump versions merely to
  perform this migration.

## Completion evidence

Before declaring the migration complete:

1. Install from the committed npm lockfile. Run text format checks, ESLint,
   TypeScript checking and all migrated helper tests using Node.js.
2. Bootstrap with the published CLI, then run Cargo format checks, strict
   workspace Clippy and all workspace tests with embedded languages enabled.
3. Build the optimized CLI and codec probe. Run relocated standalone acceptance
   using absolute binary paths and no external grammar/tool dependencies.
4. Recompile all 70 language modules with the newly built CLI and validate
   declarations/embedding against that second-pass tree.
5. Verify independent codec packaging and downstream-consumer execution after
   relocation. Validate JSR package contents without publishing.
6. Audit executable scripts, workflows and active guidance for Deno commands,
   `Deno.*` and old Rust paths. Classify remaining matches explicitly;
   filenames, historical evidence, compatibility data and unrelated dependency
   names are not interchangeable with an active Deno runtime dependency.
7. Confirm the old tracked `rust/` tree is gone, preserved files are intact, and
   tests cover the new layout and tooling instead of asserting the old one.

Do not reintroduce Deno as a development runtime or restore the retired nested
`rust/` workspace layout.

# Distribution and release contracts

This chapter defines how the Uffda CLI is packaged as the Rust `uffda` binary
and distributed through GitHub Releases, including install tooling for operators
and CI runners.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Build product contract

- Release CLI artifacts MUST be produced by `cargo build --locked --release` of
  the Rust `uffda` binary on the runner for that target. The build MUST embed
  the `./bin` language artifacts produced by `compile-lang`.
- Build inputs (source revision, build flags, and target triple) MUST be
  explicit and reproducible.
- Build outputs MUST include deterministic artifact names for each target.

## Target platform contract

- Every tagged CLI release MUST build binaries for the full target matrix:
  - `x86_64-unknown-linux-gnu`
  - `aarch64-unknown-linux-gnu`
  - `x86_64-pc-windows-msvc`
  - `aarch64-pc-windows-msvc`
  - `x86_64-apple-darwin`
  - `aarch64-apple-darwin`
- Artifact file names MUST use the form `uffda-<version>-<target>` and MUST
  append `.exe` for Windows targets.
- A release MUST identify which targets were built and validated.
- Unsupported or failed targets MUST fail the release workflow unless an
  explicit, documented release-policy exception applies.

## GitHub Releases contract

- Stable CLI versions MUST publish compiled binaries to GitHub Releases.
- Release tags MUST use the repository SemVer convention (bare tags such as
  `0.1.2`). Installers MAY accept an optional `v` prefix and MUST resolve to the
  published tag.
- Merging to `main` MUST update a draft GitHub Release through a standalone Bash
  workflow using the GitHub CLI, the semver CLI, and GitHub's built-in release
  notes generator. It MUST NOT require Deno. The version-bump commit MUST run
  `semver set` so `.github/version.yml` post hooks rewrite `VERSION`, package
  metadata, and the published crates.io package versions in `rust/**/Cargo.toml`
  (including path-dependency version pins for those crates) to the draft's
  SemVer, then refresh `rust/Cargo.lock`, so Publish can succeed when the draft
  is published.
- The next version MUST be resolved from merged PRs on `main` whose merge
  commits fall after the latest stable published release's tag: `major` takes
  precedence over `minor`, and otherwise the version increments by a patch.
  Draft releases MUST NOT be version baselines. PR creators choose labels; the
  workflow MUST NOT apply labels automatically.
- After the draft and version files are updated, the workflow MUST emit a
  `repository_dispatch` event that triggers CLI binary attachment for the latest
  draft.
- The `release-binaries` workflow MUST accept both `repository_dispatch` and
  `workflow_dispatch`, compile the target matrix from a pinned `main` revision,
  and attach or replace binaries plus checksums and the Linux install script on
  the resolved release tag. `repository_dispatch` and an unscoped
  `workflow_dispatch` MUST target the latest draft and MUST fail when no draft
  exists. `workflow_dispatch` MAY supply an explicit `tag` to recover a
  published release that still has no CLI assets (`uffda-*` / `SHA256SUMS`).
- At attach time, the workflow MUST upload when the resolved tag is still a
  draft, or when it is published but has no CLI assets yet (premature publish
  during a long matrix build). It MUST refuse to replace assets on a published
  release that already has CLI assets.
- Attach and release-target resolution MUST look up drafts by release id (or
  equivalent release metadata), not by `GET /repos/.../releases/tags/<tag>`.
  Drafts are untagged until publish, so the tags endpoint 404s and MUST NOT be
  required for attach success.
- Draft Release sets the draft `tag_name` and `target_commitish`; publishing
  creates `refs/tags/<version>` at that commit. `release-binaries` attaches
  assets only and MUST NOT create or move git tags. Draft version resolution
  MUST skip SemVer values that already have a published release or an existing
  git tag.
- Publishing a draft release makes those assets the latest stable install
  target; operators MUST wait for Release Binaries attach (and smoke) before
  publishing. JSR package publishing MAY continue on `release: published`.
- Release entries MUST include version tag, artifact list, and checksums for
  every published binary.
- Each release MUST also publish a Linux shell install script (for example
  `install.sh`) that downloads and installs the correct Linux `uffda` binary for
  the host architecture from that release.
- Release notes SHOULD include compatibility notes and migration impact for
  command/flag/output changes.
- Binary release assets MUST NOT depend on JSR install for operator or CI usage.

## JSR package contract

- After the Rust production cutover, the JSR package is a **grammar and notice
  package**, not the Deno TypeScript runtime library. The supported CLI and
  runtime ship as the Rust `uffda` binary (GitHub Releases) and crates.io
  crates.
- `deno.jsonc` MUST declare a single TypeScript export `"."` → `./mod.ts`. That
  module MUST export string constants that document the Rust cutover (where to
  install the CLI, that TypeScript library subpaths are withdrawn, and that
  compiled grammar artifacts remain in the package).
- The package MUST include the repository's `uffda.jsonc`, the `.uff` sources
  those exports name under `src/lang/`, and the compiled `bin/` tree, so
  grammars load as `jsr:@justinmchase/uffda/<export>` imports (see
  [packages](../../modules.spec.md#packages)). `uffda.jsonc` MUST export
  reusable tokenizer, pattern, expression, import-declaration,
  export-declaration, and Uffda-language `.uff` modules.
- `deno.jsonc` MUST NOT publish TypeScript subpath exports for the former Deno
  grammar/runtime APIs (`./grammar`, `./runtime`, `./tokenizer`, `./pattern`,
  `./expression`, `./uffda`, `./language-metadata`, and similar). Those APIs are
  retired along with the in-tree Deno reference implementation (see
  [public grammar APIs](../../languages.spec.md#public-grammar-apis)).
- Publish configuration MUST keep the package small: include only the stub
  `mod.ts`, `uffda.jsonc`, `README.md`, `src/lang/**/*.uff`, and `bin/`, and
  exclude agent docs, editor/CI metadata, requirement trees, Rust sources, and
  Deno implementation TypeScript. Excluded paths MUST keep every published file
  path under the length limits enforced by the JSR tarball verify step
  (ustar-compatible packing).
- Grammar package exports MUST remain generic parser infrastructure and MUST NOT
  add downstream application-language behavior.

## CI setup action contract

- The repository MUST provide a reusable GitHub Action (for example
  `uffda-setup`) that workflows can use to install the Uffda CLI onto a runner.
- The action MUST accept a version input and SHOULD default to the latest stable
  GitHub Release tag when unspecified.
- The action MUST map the runner operating system and architecture to the
  matching Deno compile target triple.
- The action MUST download the corresponding release binary, verify its checksum
  when checksums are published, install it onto the runner `PATH`, and expose an
  invocable `uffda` command.
- Workflows that need the published CLI MUST prefer this action over ad-hoc
  download scripts.

## Integrity and provenance contract

- Artifacts MUST include checksum verification data for every published binary.
- Release metadata SHOULD identify the source revision used for compilation.
- Rebuilt artifacts for the same release tag MUST be treated as a policy
  exception and documented.
- If a release includes a dev-channel dependency (for example a pinned
  `@tui/tui` development version), release metadata MUST call that out
  explicitly.

## Failure and rollback contract

- Failed release publication MUST fail the release workflow deterministically.
- If a release artifact is invalid, rollback/reissue policy MUST be explicit and
  operator-visible.

## Composition intent

- Distribution and release contracts SHOULD keep binary delivery consistent with
  the same runtime semantics validated in source-based test workflows.
- Published CLI binaries are the entry point for
  [compiler bootstrap](../compiler-bootstrap.spec.md) progression.

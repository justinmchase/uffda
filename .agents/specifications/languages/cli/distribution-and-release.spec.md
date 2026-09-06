# Distribution and release contracts

This chapter defines how the Uffda CLI is packaged with `deno compile` and
distributed through GitHub Releases, including install tooling for operators and
CI runners.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Build product contract

- CLI distribution artifacts MUST be generated via `deno compile`.
- Build inputs (source revision, build flags, and target triple) MUST be
  explicit and reproducible.
- Build outputs MUST include deterministic artifact names for each target.

## Target platform contract

- Every tagged CLI release MUST build binaries for the full Deno `compile`
  target matrix:
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
- Merging to `main` MUST update a draft GitHub Release (Release Drafter).
- After the draft is updated, Release Drafter MUST emit a `repository_dispatch`
  event that triggers CLI binary attachment for the latest draft.
- Draft release notes MUST document the manual `workflow_dispatch` path used to
  re-attach CLI binaries.
- The attach workflow MUST accept both `repository_dispatch` and
  `workflow_dispatch`, compile the target matrix from `main`, attach or replace
  binaries plus checksums and the Linux install script on the latest draft
  release, and fail when no draft release exists.
- Publishing a draft release makes those assets the latest stable install
  target; JSR package publishing MAY continue on `release: published`.
- Release entries MUST include version tag, artifact list, and checksums for
  every published binary.
- Each release MUST also publish a Linux shell install script (for example
  `install.sh`) that downloads and installs the correct Linux binary for the
  host architecture from that release.
- Release notes SHOULD include compatibility notes and migration impact for
  command/flag/output changes.
- Binary release assets MUST NOT depend on JSR install for operator or CI usage.

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

# Distribution and release contracts

This chapter defines how the Uffda CLI is packaged with `deno compile` and
distributed through GitHub Releases.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Build product contract

- CLI distribution artifacts MUST be generated via `deno compile`.
- Build inputs (source revision, build flags, and target triple) MUST be
  explicit and reproducible.
- Build outputs MUST include deterministic artifact names for each target.

## Target platform contract

- The supported target matrix MUST be declared as part of release policy.
- A release MUST identify which targets were built and validated.
- Unsupported targets MUST produce explicit documentation and diagnostics at
  build time.

## GitHub Releases contract

- Stable CLI versions MUST publish compiled binaries to GitHub Releases.
- Release entries MUST include version tag, artifact list, and checksums.
- Release notes SHOULD include compatibility notes and migration impact for
  command/flag/output changes.

## Integrity and provenance contract

- Artifacts SHOULD include checksum verification data.
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

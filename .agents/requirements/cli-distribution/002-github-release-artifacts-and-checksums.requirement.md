---
id: cli-distribution-002
title: GitHub Releases publish binaries and checksums
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#github-releases-contract; .agents/specifications/languages/cli/distribution-and-release.spec.md#integrity-and-provenance-contract"
---

# GitHub Release Artifacts And Checksums

## Requirement

Preconditions:

- A stable CLI version tag is published.

Expected behavior:

- Merging to `main` MUST maintain a draft GitHub Release for the resolved
  version.
- Draft notes MUST use GitHub's built-in release notes generator, comparing the
  checked-out commit against the latest stable published release tag, not a
  draft tag. Notes generation MUST use the commit SHA as its target so an
  existing draft tag pointing at an older build cannot omit new changes.
- Version selection MUST consider all merged PRs targeting `main` whose merge
  commits fall after that tag (paginated). A `major` label selects a major
  increment; otherwise `minor` selects a minor increment; all other labels and
  unlabeled changes select the default patch increment. With no stable published
  release, the baseline MUST be `0.0.0`.
- The workflow MUST run on pushes to `main`, skip its own `[no ci]` version
  commits, and MUST NOT automatically label PRs or use the Release Drafter
  action. Release resolution and draft updates MUST use Bash, `gh`, and the
  semver CLI without requiring Deno.
- The standalone draft workflow MUST dispatch `repository_dispatch` event type
  `release-binaries` after the draft/version update on `main`.
- Draft updates MUST preserve the draft state and MUST fail if the selected
  release has been published in the meantime. API errors MUST fail the workflow.
- The `release-binaries` workflow MUST accept `repository_dispatch` and
  `workflow_dispatch`, compile the full target matrix from a pinned `main`
  revision, and attach or replace every binary on the latest draft release.
- While the release is still a draft, `release-binaries` MUST set the draft
  release `target_commitish` to that pinned build revision so publishing creates
  `refs/tags/<version>` at the compiled commit. It MUST NOT create or move git
  tags itself, and MUST refuse versions whose git tag already exists.
- Draft version resolution MUST skip SemVer values that already have a published
  release or an existing git tag (burnt tags are not reused).
- The draft release MUST include checksum data covering every published binary
  plus the Linux install script after the attach workflow succeeds.
- Failed binary builds or missing checksums MUST fail the attach workflow.
- Release tags follow bare SemVer (`0.1.2`); installers accept an optional `v`
  prefix.

Postconditions:

- Downstream installers can download and verify release binaries without
  rebuilding from source.

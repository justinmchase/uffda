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
- Release Drafter MUST dispatch `repository_dispatch` event type
  `attach-draft-cli-binaries` after the draft/version update on `main`.
- The attach workflow MUST accept `repository_dispatch` and `workflow_dispatch`,
  compile the full target matrix from `main`, and attach or replace every binary
  on the latest draft release.
- The draft release MUST include checksum data covering every published binary
  plus the Linux install script after the attach workflow succeeds.
- Failed binary builds or missing checksums MUST fail the attach workflow.
- Release tags follow bare SemVer (`0.1.2`); installers accept an optional `v`
  prefix.

Postconditions:

- Downstream installers can download and verify release binaries without
  rebuilding from source.

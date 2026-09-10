---
id: cli-adoption-001
title: Checks workflow installs the published CLI via uffda-setup
spec_ref: ".agents/specifications/languages/cli.spec.md#status; .agents/specifications/languages/cli/distribution-and-release.spec.md#ci-setup-action-contract"
---

# Checks Uses Uffda Setup

## Requirement

Preconditions:

- The reusable `uffda-setup` action is available in-repo.
- GitHub Releases publish platform-matched CLI binaries.

Expected behavior:

- The `checks` workflow MUST install the Uffda CLI through `uffda-setup`.
- The setup step MUST request the `latest` published release, or a pinned
  published SemVer when `latest` cannot compile the current tree (documented
  chicken-egg pin).
- After setup, the workflow MUST be able to invoke `uffda` on `PATH`.

Postconditions:

- Repository CI prefers the published CLI install path over ad-hoc download
  scripts.

---
id: cli-distribution-004
title: uffda-setup action installs the platform-matched CLI
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#ci-setup-action-contract"
---

# Uffda Setup GitHub Action

## Requirement

Preconditions:

- A GitHub Release publishes CLI binaries and checksums for the supported target
  matrix.

Expected behavior:

- The reusable `uffda-setup` action MUST map runner OS/arch to the matching Deno
  compile target.
- The action MUST download that release binary, verify checksums when present,
  and place `uffda` on `PATH`.
- The action MUST accept a version input and SHOULD default to the latest stable
  release tag.

Postconditions:

- Workflows can install and invoke `uffda` without custom download logic.

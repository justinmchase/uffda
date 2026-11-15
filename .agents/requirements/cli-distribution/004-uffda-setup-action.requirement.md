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
- Checksum verification MUST hash the asset bytes. A digest that changes
  because line endings were translated MUST NOT be accepted.
- The action shell MUST run on the Bash GitHub Actions provides for that
  runner, including Bash 3.2 on macOS.
- The action MUST accept a version input and SHOULD default to the latest stable
  release tag that publishes CLI assets (`SHA256SUMS` plus at least one
  `uffda-*` binary). An empty published tag MUST NOT be selected as `latest`.

Postconditions:

- Workflows can install and invoke `uffda` without custom download logic.
- Tests: `src/cli/requirement_ports.rs`, `tests/build.rs`,
  `src/cli/surface_ports.rs`.

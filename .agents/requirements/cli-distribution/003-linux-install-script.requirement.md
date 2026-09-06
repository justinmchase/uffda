---
id: cli-distribution-003
title: Linux install script installs the matching release binary
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#github-releases-contract"
---

# Linux Install Script

## Requirement

Preconditions:

- A GitHub Release includes Linux CLI binaries and an install script asset.

Expected behavior:

- The install script MUST download the correct Linux binary for the host
  architecture (`x86_64` or `aarch64`) from the selected release.
- The install script MUST install an executable named `uffda` onto a writable
  destination on `PATH` (or a documented default such as `~/.local/bin`).
- The install script MUST verify the downloaded binary against published
  checksums when checksums are available.

Postconditions:

- Linux operators can install the CLI with a single shell script without Deno
  installed on the host.

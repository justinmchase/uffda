---
id: cli-distribution-001
title: Deno compile publishes the full target matrix
spec_ref: ".agents/specifications/languages/cli/distribution-and-release.spec.md#target-platform-contract; .agents/specifications/languages/cli/distribution-and-release.spec.md"
---

# Deno Compile Target Matrix

## Requirement

Preconditions:

- A tagged CLI release build is running.

Expected behavior:

- The release build MUST compile the CLI for each of:
  `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`,
  `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc`, `x86_64-apple-darwin`,
  and `aarch64-apple-darwin`.
- Artifact names MUST be `uffda-<version>-<target>` with `.exe` for Windows
  targets.

Postconditions:

- Operators can select a binary for any Deno-supported compile target from the
  release.

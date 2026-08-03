---
id: cli-compile-002
title: CLI compile output paths and overwrite behavior are deterministic
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# Output Path Policy and Overwrite Behavior

## Requirement

Preconditions:

- Compile mode is provided an output directory and one or more source units.

Expected behavior:

- Output path derivation MUST be deterministic from source path and output
  directory.
- Potential output collisions MUST fail deterministically.
- Existing output files MUST fail when overwrite is disabled and MUST be
  replaced when overwrite is enabled.

Postconditions:

- Operators can reason about artifact placement and replacement behavior without
  ambiguity.

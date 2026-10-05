---
id: cli-compile-002
title: CLI compile output paths and overwrite behavior are deterministic
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# Output Path Policy and Overwrite Behavior

## Requirement

Preconditions:

- Compile mode is provided one or more source units and the artifact layout of
  the project it uses (see
  [output directory](../../specifications/languages/project-file.spec.md#output-directory)).

Expected behavior:

- Output path derivation MUST be deterministic from the source path and the
  layout: `<root>/<path>.uff` writes `<outDir>/ast/<path>.uffda.ast.json`.
- A source outside the layout's root MUST fail its unit with
  `CLI_COMPILE_SOURCE_OUTSIDE_ROOT` and MUST NOT be written.
- `--out-dir` (a one-release bootstrap bridge) MUST be accepted only when it
  names the layout's outDir; any other value MUST fail the command with a usage
  error and write nothing. On any command but `compile` it MUST be a usage
  error.
- Potential output collisions MUST fail deterministically.
- Existing output files MUST fail when overwrite is disabled and MUST be
  replaced when overwrite is enabled.

Postconditions:

- Operators can reason about artifact placement and replacement behavior without
  ambiguity.

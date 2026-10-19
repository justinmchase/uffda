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
  layout: `<root>/<path>.uff` writes both `<outDir>/ast/<path>.uff.ast` and
  `<outDir>/ast/<path>.uff.ast.json`.
- A source outside the layout's root MUST fail its unit with
  `CLI_COMPILE_SOURCE_OUTSIDE_ROOT` and MUST NOT be written.
- No argument changes the output directory: `--out-dir` MUST be rejected as an
  unknown flag, writing nothing.
- Potential output collisions MUST fail deterministically.
- When overwrite is disabled, an existing `.uff.ast` or `.uff.ast.json` for the
  unit MUST fail with `CLI_COMPILE_OUTPUT_EXISTS`. When overwrite is enabled,
  both files MUST be replaced.

Postconditions:

- Operators can reason about artifact placement and replacement behavior without
  ambiguity.

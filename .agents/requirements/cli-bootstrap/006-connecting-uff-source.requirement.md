---
id: cli-bootstrap-006
title: Connecting language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Connecting Uff Source

## Requirement

Preconditions:

- Character-leaf modules convert to `.uff` one at a time after G1–G3 review.

Expected behavior:

- `src/lang/common/characters/connecting.uff` MUST declare and export the
  `Connecting` rule using Uffda source syntax (`\cPc`).
- Compiling that file with the Uffda CLI MUST succeed and emit AST JSON under
  `./bin/`.

Postconditions:

- Connecting is converted alongside Digit as Phase 0 character leaves.

---
id: cli-bootstrap-040
title: Source language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/source-normalization.spec.md#standard-library-helpers-bootstrap-precursors"
---

# Source Uff Source

## Requirement

Preconditions:

- Published CLI includes B6 std helpers (`normalized_unit`, `normalization_map`,
  `line_starts`, `units`, `source_document`, match-aware `match_leaf_offset`)
  (0.1.24+).

Expected behavior:

- `src/lang/source/mod.uff` MUST export `Source`, `NormalizedText`, `LineIndex`,
  `UnitIndex`, and `SourceDocument`.
- `Source` MUST pipeline those stages and assemble documents via
  `(source_document …)`.
- Unit projections MUST use `(match_leaf_offset "start"|"end")` with
  `normalized_unit`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Source is converted as Phase 5 module #47.
- Dependents import `../source/mod.uff`; the ModuleDeclaration twin is gone.
- Host `mod.ts` MAY remain for `normalizeSource` and type re-exports only.

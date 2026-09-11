---
id: cli-bootstrap-040
title: Source language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/source-normalization.spec.md#standard-library-helpers-bootstrap-precursors"
---

# Source Uff Source

## Requirement

Preconditions:

- Published CLI includes B6 std helpers (`normalized_unit`, `normalization_map`,
  `line_starts`, `units`, `iterable`, `symbol`, match-aware
  `match_leaf_offset`), object computed keys, and async-iterable stream support
  (0.2.1+).

Expected behavior:

- `src/lang/source/mod.uff` MUST export `Source`, `NormalizedText`, `LineIndex`,
  `UnitIndex`, and `SourceDocument`.
- `Source` MUST pipeline those stages and assemble documents as an object
  literal spreading `(iterable t)` (attaching `Symbol.asyncIterator`) alongside
  `documentId`, `text`, `lineStarts`, `units`, and `normalizationMap`.
- Unit projections MUST use `(match_leaf_offset "start"|"end")` with
  `normalized_unit`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Source is authored as `.uff`.
- Dependents import `../source/mod.uff`; the ModuleDeclaration twin is gone.
- Host `mod.ts` MAY remain for `normalizeSource` and type re-exports only.

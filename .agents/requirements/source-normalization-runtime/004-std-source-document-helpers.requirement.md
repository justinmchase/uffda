---
id: source-normalization-runtime-004
title: Std helpers assemble checksum, indexes, and SourceDocument without Native host logic
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#standard-library-helpers-bootstrap-precursors"
---

# Source Normalization Std Helpers

## Requirement

Preconditions:

- The runtime std globals include `checksum`, `line_starts`, `units`,
  `document_id`, `normalized_unit`, `normalization_map`, `source_document`, and
  match-aware `match_leaf_offset`.

Expected behavior:

- `checksum` MUST return a stable 8-hex digest for fixed text.
- `line_starts` and `units` MUST produce deterministic indexes for fixed
  normalized text and normalization map.
- `source_document` MUST assemble a `SourceDocument` whose iterator yields the
  characters of `text`.
- `match_leaf_offset` MUST return the numeric leaf path segment for `"start"` or
  `"end"` of the current match span when invoked as a match-aware std callable.

Error behavior:

- Non-string / non-array inputs MUST throw TypeError according to each helper’s
  contract.

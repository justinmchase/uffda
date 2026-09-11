---
id: source-normalization-runtime-004
title: Std helpers assemble checksum, indexes, and SourceDocument without Native host logic
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#standard-library-helpers-bootstrap-precursors"
---

# Source Normalization Std Helpers

## Requirement

Preconditions:

- The runtime std globals include `checksum`, `length`, `units`, `iterable`, and
  match-aware `match_leaf_offset`. `line_starts`, `document_id`,
  `normalized_unit`, and `normalization_map` are module-local `func`
  declarations in `src/lang/source/mod.uff` composed from those globals.

Expected behavior:

- `checksum` MUST return a stable 8-hex digest for fixed text.
- `length` MUST return the length/size of a string, array, Set, or Map.
- `line_starts` and `units` MUST produce deterministic indexes for fixed
  normalized text and normalization map.
- `document_id` MUST return `source:{length}:{checksum}` for the given text.
- `iterable` MUST normalize any `Symbol.iterator`/`Symbol.asyncIterator` value
  to an async iterable, and `SourceDocument` object literals assembled with it
  (via computed keys) MUST yield the characters of `text` when consumed with
  `for await...of`.
- `match_leaf_offset` MUST return the numeric leaf path segment for `"start"` or
  `"end"` of the current match span when invoked as a match-aware std callable.

Error behavior:

- Non-string / non-array inputs MUST throw TypeError according to each helper’s
  contract.

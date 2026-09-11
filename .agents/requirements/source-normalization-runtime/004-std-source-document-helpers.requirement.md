---
id: source-normalization-runtime-004
title: Std helpers assemble digests, indexes, and SourceDocument without Native host logic
spec_ref: ".agents/specifications/languages/source-normalization.spec.md#standard-library-helpers-bootstrap-precursors"
---

# Source Normalization Std Helpers

## Requirement

Preconditions:

- The runtime std globals include `sha256`, `base58`, `slice`, `length`,
  `units`, `iterable`, and match-aware `match_leaf_offset`. `line_starts`,
  `document_id`, `normalized_unit`, and `normalization_map` are module-local
  `func` declarations in `src/lang/source/mod.uff` composed from those globals.

Expected behavior:

- `sha256` MUST return a stable SHA-256 digest (raw bytes) for fixed text.
- `base58` MUST return the Base58 (Bitcoin alphabet) encoding of bytes.
- `slice` MUST return a slice of a string or array using JS `slice` semantics
  (exclusive `end`, negative indices count from the end).
- `length` MUST return the length/size of a string, array, Set, or Map.
- `line_starts` and `units` MUST produce deterministic indexes for fixed
  normalized text and normalization map.
- `document_id` MUST return `source:{length}:{digest}` for the given text, where
  `digest` is the first 8 characters of the Base58-encoded SHA-256 digest of the
  text.
- `iterable` MUST normalize any `Symbol.iterator`/`Symbol.asyncIterator` value
  to an async iterable, and `SourceDocument` object literals assembled with it
  (via computed keys) MUST yield the characters of `text` when consumed with
  `for await...of`.
- `match_leaf_offset` MUST return the numeric leaf path segment for `"start"` or
  `"end"` of the current match span when invoked as a match-aware std callable.

Error behavior:

- Non-string / non-array / non-`Uint8Array` inputs MUST throw TypeError
  according to each helper’s contract.

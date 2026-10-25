---
id: runtime-strings-002
title: Runtime values, ASTs and property keys preserve lossless text end to end
spec_ref: ".agents/specifications/runtime/strings.spec.md#operations; .agents/specifications/runtime/strings.spec.md#text-boundaries; .agents/specifications/runtime/value-provenance.spec.md#string-character-provenance"
---

# Lossless runtime surfaces

## Requirement

Preconditions:

- Runtime text or an AST literal contains arbitrary UTF-16 units, including
  isolated high and low surrogates.

Expected behavior:

- Typed expressions, pattern literals, authored string segments, member names,
  fixed and computed object keys, module declarations and runtime values MUST
  preserve every unit.
- JSON AST and subject ingestion MUST decode a lossless structural data model
  directly from raw JSON. A scalar `serde_json::Value` supplied by a host MAY be
  imported as scalar data, but MUST NOT be described as recovering units that
  were already rejected or discarded by an earlier decoder.
- Length, `at`, member indexing and `slice` MUST use UTF-16 offsets; iteration
  and pattern iterable normalization MUST pair only matching surrogate units.
- Comparison, property lookup and global-symbol descriptions MUST preserve unit
  equality and ordering. Interpolation, join and format MUST preserve newly
  formed surrogate pairs and isolated units.
- JSON serialization MUST escape isolated units in values and keys, including
  `toJSON` key arguments and returned values.
- Scalar-only hashing, source display and formatter output MUST error explicitly
  on isolated units. No replacement text or invalid source syntax may be
  emitted.
- Character classes and regular expressions MUST match lossless text without
  converting isolated surrogates to scalar strings.
- Splitting an existing pair MUST retain its source span; concatenating a new
  pair across segments MUST cover both source spans. Root provenance MUST
  continue to use the existing code-point positions.

Postconditions:

- Tests: `src/json.rs`, `src/expression.rs`, `src/program.rs`,
  `src/value.rs`, `src/coercion.rs`, `src/evaluate/tests.rs`,
  `src/globals/tests.rs`, `src/pattern/tests.rs`,
  `src/provenance.rs`, `src/module.rs`, `src/resolver.rs`,
  `src/resolver/graph/tests.rs`, `src/runtime/tests.rs`,
  `src/output.rs`, `src/languages.rs`, `src/cli.rs`, and the
  shared `tests/rust/string-fixtures.json` corpus.

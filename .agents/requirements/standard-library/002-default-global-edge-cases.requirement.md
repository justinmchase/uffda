---
id: standard-library-002
title: Default globals satisfy their declared value and edge-case contracts
spec_ref: ".agents/specifications/standard-library.spec.md#default-global-surface; .agents/specifications/standard-library.spec.md#composition-and-data-boundaries; .agents/specifications/standard-library.spec.md#approved-platform-divergence"
---

# Default global edge cases

## Requirement

Preconditions:

- The runtime has its default global environment.
- Inputs are values supported by the global's documented purpose and signature,
  unless a case below explicitly checks rejection.

Expected behavior:

- Each global MUST satisfy its acceptance cases below in both TypeScript and
  Rust. The shared portable fixtures MUST be evaluated by both runtimes.
- Errors MUST remain observable failures; the runtime MUST NOT return a
  success-shaped placeholder for an unsupported input or failed callback.
- Identity, undefined, native values, and provenance MUST be checked through
  runtime values, not inferred from JSON serialization.
- `json` hook scheduling retains the documented platform divergence.

| Global         | Required acceptance case                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`          | Adds finite and fractional numeric operands; propagates IEEE-754 results for non-finite operands.                                                     |
| `at`           | Uses UTF-16 code-unit string indexing and preserves a selected array element's reference; Map and Set indices follow insertion order.                 |
| `base58`       | Encodes byte values including leading zero bytes; rejects non-byte inputs.                                                                            |
| `coalesce`     | Skips both null and undefined, returns false/zero when selected, and preserves the selected aggregate reference.                                      |
| `compare`      | Orders numbers and strings within their respective domains; unsupported operand types fail explicitly.                                                |
| `eq`           | Uses strict runtime equality: NaN is unequal to itself, signed zero compares equal, null differs from undefined, and aggregates compare by identity.  |
| `enumerate`    | Enumerates strings by Unicode code point and collections in their defined iteration order, with stable zero-based indices where applicable.           |
| `filter`       | Is lazy, retains values whose callback result is truthy, and propagates callback failures when consumed.                                              |
| `flat`         | Honors depth zero and finite depth, preserves order, and rejects cyclic input rather than looping.                                                    |
| `format`       | Replaces only available non-nullish indexed arguments, leaves unmatched placeholders intact, and rejects implicit composite/callable text conversion. |
| `from_entries` | Accepts supported pair/record entry forms; a later duplicate key replaces the earlier value without silently dropping unrelated entries.              |
| `gt`           | Returns false for equal supported operands and compares supported numeric/string operands consistently with `compare`.                                |
| `gte`          | Returns true for equal supported operands and compares supported numeric/string operands consistently with `compare`.                                 |
| `has`          | Checks array/Set/Map membership and own object-key presence; uses SameValueZero membership for array/Set values.                                      |
| `id`           | Returns the exact input value, including aggregate, native, undefined, and wrapped references.                                                        |
| `int`          | Parses a base-10 integer prefix with sign/whitespace handling and rejects composite/callable coercion.                                                |
| `iterable`     | Normalizes supported arrays, strings, and host/authored iterators; iteration is demand-driven and failures propagate when consumed.                   |
| `join`         | Converts nullish elements to empty fields, uses the supplied separator, and rejects unsupported composite/callable scalar conversion.                 |
| `json`         | Serializes supported values explicitly, rejects callables and unsupported BigInt, and preserves documented date/error behavior and hook divergence.   |
| `last`         | Returns the final string/array element, including the specified UTF-16 string element, or the supplied fallback for empty/unsupported input.          |
| `length`       | Counts UTF-16 code units for strings and entries/elements for arrays, Maps, and Sets; unsupported values fail.                                        |
| `lt`           | Returns false for equal supported operands and compares supported numeric/string operands consistently with `compare`.                                |
| `lte`          | Returns true for equal supported operands and compares supported numeric/string operands consistently with `compare`.                                 |
| `map`          | Is lazy, yields callback results in source order, and propagates callback failures when consumed.                                                     |
| `not`          | Negates runtime truthiness, including falsey zero, empty string, null, and undefined, without treating empty aggregates as false.                     |
| `one`          | Returns the only array element exactly when length is one; otherwise returns the fallback.                                                            |
| `pack`         | Returns all arguments in order, retaining undefined slots and aggregate/native references.                                                            |
| `pluck`        | Preserves source iteration order and selected values, including undefined for missing properties.                                                     |
| `reduce`       | Folds left-to-right from the explicit initial value and propagates callback failures.                                                                 |
| `scan`         | Lazily yields each left-to-right accumulator after applying the callback.                                                                             |
| `sha256`       | Hashes scalar UTF-8 text to the documented 32-byte digest; non-scalar isolated-surrogate input fails explicitly.                                      |
| `slice`        | Applies half-open, negative/clamped bounds; preserves selected array element references and original per-character string provenance.                 |
| `sub`          | Subtracts numeric operands with IEEE-754 behavior.                                                                                                    |
| `symbol`       | Returns stable identity for repeated registered names and the corresponding well-known singleton; does not conflate different names.                  |
| `to_set`       | Preserves first-seen order, deduplicates with Set/SameValueZero semantics, and supports the documented collection sources.                            |
| `when`         | Selects the then or else value by runtime truthiness and returns the selected reference unchanged.                                                    |

Postconditions:

- Every row is exercised by the shared portable fixtures or a requirement-cited
  direct-runtime test in the Rust runtime.
- The shared surface, behavior fixture and direct-runtime assertions are checked
  by `rust/src/globals/tests.rs` against `test/rust/globals-fixtures.json` and
  `test/rust/globals-surface-fixtures.json`.
- Tests: `rust/src/globals/tests.rs`. Identity, provenance, and native JSON
  acceptance for the ported globals, including `slice`, are in
  `rust/src/globals/tests.rs`.

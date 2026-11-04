---
id: data-codec-008
title: Codec preserves arbitrary Object keys and insertion order
spec_ref: ".agents/specifications/data-codec/values.spec.md#syntax; .agents/specifications/data-codec/values.spec.md#identity-and-reconstruction; .agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics"
---

# Native Object Associations

## Requirement

Preconditions:

- A codec document contains an Object with arbitrary data values as keys, or a
  runtime Object is encoded.

Expected behavior:

- Object keys MUST accept every supported codec data value.
- Identifier shorthand MUST denote a string key.
- Duplicate keys MUST be detected with SameValueZero equality and MUST fail
  rather than overwrite.
- NaN keys MUST compare equal, positive and negative zero MUST compare equal,
  primitives MUST compare by value, and reference values MUST compare by
  identity.
- Object entry insertion order MUST survive parsing, materialization and
  encoding.
- The legacy `@map` tag MUST be rejected.
- The standalone typed decoder MUST reject non-string keys when the requested
  target schema requires string field names.

Postconditions:

- The encoded or decoded Object preserves its ordered key/value associations.
- Tests: `src/codec/src/data/tests.rs`, `src/codec/src/data/parser.rs`,
  `src/codec_runtime/data/tests.rs`.

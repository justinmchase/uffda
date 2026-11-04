---
id: data-codec-007
title: Typed codec data decodes directly from owned documents without a JSON or runtime bridge
spec_ref: ".agents/specifications/data-codec.spec.md#standalone-library"
---

# Direct typed decoding

## Requirement

Preconditions:

- A codec document has passed native syntax and structural validation.

Expected behavior:

- Typed structural decoding MUST read the owned codec document without runtime
  materialization, expression execution, a resolver or a JSON text round-trip.
- Schema fields, nested containers, integer fields and optional null fields MUST
  decode with explicit type validation. Lossless string targets MUST preserve
  isolated UTF-16 surrogate units; scalar string targets MUST reject them.
- Native values MUST NOT silently become strings, null, missing values or empty
  objects when a structural target cannot represent them. Unsupported target
  conversions MUST fail explicitly.
- A target schema MAY explicitly ignore unrecognized fields without decoding
  their values. This MUST NOT make a native value accepted by a JSON value
  target.

Postconditions:

- Typed decoding does not change the document or its encoded bytes.
- Tests: `src/codec/src/data/de.rs`, `src/codec_runtime/declaration.rs`.

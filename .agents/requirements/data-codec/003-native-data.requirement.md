---
id: data-codec-003
title: Codec data construction and encoding preserve fixed native values
spec_ref: ".agents/specifications/data-codec/values.spec.md#identity-and-reconstruction; .agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics; .agents/specifications/data-codec/values.spec.md#syntax"
---

# Native data reconstruction and encoding

## Requirement

Preconditions:

- An authored data AST or a validated data document is supplied.

Expected behavior:

- Fixed construction MUST validate token strings, finite number overflow,
  millisecond date precision, canonical base64url and native tag payload shapes.
- Big integers MUST preserve arbitrary precision. Registry symbols MUST preserve
  their keys; errors MUST retain name/message and optional stack/cause.
- Duplicate object keys, set entries and map keys MUST fail rather than
  collapse.
- Compact/pretty encoding MUST preserve all supported values including negative
  zero, nonfinite numbers, surrogate units and nested native values.
- Encoding MUST reject composite aliases/cycles and enforce output byte/depth
  limits. Traversal and document destruction MUST not recurse with input depth.
- Nesting MUST count simultaneous physical containers, including map entry
  pairs, not tag names. AST construction MUST enforce the compact encoded byte
  limit; source decoding MUST independently enforce retained source byte limits.
- Invalid or excessively deep owned ASTs MUST be disposed of without host
  recursion, including when options are invalid.
- The value decoder MUST stop after one completed record and return the consumed
  byte count and original frame span. Syntax and native payload errors MUST
  poison delivery until reset; cancellation and EOF MUST preserve the framing
  lifecycle.
- Valid documents MUST materialize to collector-backed native runtime values.
  BigInt equality MUST be value-based; Date and Error equality MUST be
  identity-based; Error causes MUST remain traced. Export MUST traverse without
  recursion and reject aliases, cycles, local/execution values and symbol-keyed
  objects.
- Ordinary JSON serialization MUST reject BigInt, encode Date as UTC RFC3339,
  and encode Errors without enumerable user properties as `{}`. Codec export
  MUST retain offsets for valid millisecond-precision dates; submillisecond
  instants MUST fail.

Postconditions:

- Tests: `src/codec_runtime/data/tests.rs`, `src/value.rs`,
  `src/coercion.rs`, `src/output.rs`, `src/globals/tests.rs`, and
  `src/gc_tests.rs`.

---
id: runtime-strings-001
title: Runtime text preserves every UTF-16 code unit at explicit host boundaries
spec_ref: ".agents/specifications/runtime/strings.spec.md#operations; .agents/specifications/runtime/strings.spec.md#text-boundaries"
---

# Lossless runtime text

## Requirement

Preconditions:

- Text is constructed from UTF-16 units or a scalar UTF-8 host string.

Expected behavior:

- Equality and ordering MUST compare units, not Unicode scalar order.
- Length and indexing MUST preserve individual units. Code-point iteration MUST
  combine only adjacent high/low surrogate pairs.
- Conversion to UTF-8 MUST fail on isolated surrogates.
- JSON string encoding/decoding MUST round-trip all 65,536 individual UTF-16
  units, mixed isolated units, valid pairs, controls and escaped punctuation.
- Malformed JSON strings MUST return explicit errors with byte offsets; unknown
  escapes, short/nonhex unicode escapes, raw controls, missing quotes and
  trailing data MUST NOT be accepted.
- JSON string decoding MUST NOT invoke expression evaluation or host
  constructors.
- Typed JSON fields and map keys using runtime text MUST preserve escaped
  surrogate units rather than going through scalar-only host strings.
- An explicit WTF-8 boundary MUST accept surrogate code-unit encodings and valid
  UTF-8, and MUST reject malformed/truncated/overlong encodings instead of
  substituting replacement characters.

Postconditions:

- The string primitive is suitable for subsequent AST/value integration without
  character replacement. This requirement alone does not assert that all runtime
  surfaces have migrated.
- Tests: inline tests in `rust/src/text.rs`.

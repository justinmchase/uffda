---
id: standard-library-003
title: Pure codec globals encode and decode exactly one strict data value
spec_ref: ".agents/specifications/standard-library.spec.md#codec-serialization"
---

# Codec serialization globals

## Requirement

Expected behavior:

- Default globals MUST include `to_codec(value)` and `from_codec(text)`, each
  with declared arity one and ordinary callable metadata, lookup and shadowing.
- Each call MUST receive exactly one argument. Options and converters MUST NOT
  be accepted.
- `to_codec` MUST return canonical compact text without a trailing LF, using
  fixed codec types and default byte/depth limits. It MUST preserve undefined,
  lossless strings and native values; aliases, cycles, callables and unsupported
  runtime values MUST fail rather than silently coerce or invoke hooks.
- `from_codec` MUST require a string containing exactly one codec value, permit
  surrounding whitespace/comments, and materialize genuine runtime values in the
  caller's collector arena.
- Empty input, multiple records, malformed trailing input, unknown tags and
  invalid native payloads MUST fail explicitly through runtime errors.
- Isolated surrogates in decoded values MUST be lossless; isolated surrogates in
  source text MUST be escaped instead of silently repaired.
- Decoded values MUST remain valid across collector cycles.

Postconditions:

- Tests: `rust/src/globals/tests.rs`.

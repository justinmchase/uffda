---
id: data-codec-006
title: The strict codec is reusable without a runtime or grammar dependency
spec_ref: ".agents/specifications/data-codec.spec.md#standalone-library; .agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics"
---

# Standalone codec library

## Requirement

Expected behavior:

- `uffda-codec` MUST provide reading, writing, framing, lossless text and fixed
  native construction without a runtime, resolver, grammar or GC dependency.
- `from_str` MUST consume exactly one complete value, allowing surrounding
  trivia and comments. Empty input, multiple records and malformed trailing
  input MUST fail.
- `to_string` MUST emit deterministic compact value text without a trailing LF.
  Stream record emission adds LF explicitly.
- `DataError::offset()` MUST expose absolute byte offsets for syntax/framing
  failures, invariant under input chunk boundaries. Messages MUST describe the
  failed expectation. No grammar reparse or alternate decoder runs on failure.
- The public postorder document constructor MUST reject invalid indices, cycles,
  composite aliases, duplicate keys and invalid Set/Map entries.
- Runtime adapters MUST reuse codec parsing, text and native validation rather
  than duplicate those algorithms. The authored grammar remains available for
  composition, rich source diagnostics and differential acceptance tests.
- The format MUST have no user converters, custom tags or permissive modes.
  Low-level limits and pretty presentation MUST NOT change its value contract.

Postconditions:

- Tests: `rust/codec/tests/public_api.rs`, `rust/codec/src/data/tests.rs`,
  `rust/codec/src/data/parser.rs`, `rust/codec/src/text.rs`,
  `rust/src/codec/data/tests.rs`, `rust/src/globals/tests.rs`.

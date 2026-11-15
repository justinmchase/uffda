---
id: data-codec-002
title: Authored codec grammar parses only comma-free data syntax
spec_ref: ".agents/specifications/data-codec/values.spec.md#syntax; .agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics"
---

# Safe codec value syntax

## Requirement

Preconditions:

- One framed UTF-8 record is passed to the authored data grammar.

Expected behavior:

- It MUST parse scalars, raw lossless quoted tokens, numbers, bigint tokens,
  whitespace-separated arrays, objects with quoted or identifier keys and fixed
  native tags into discriminated data AST variants.
- Date, bytes, symbol, and error MUST accept both spellings: `d"…"` and
  `@date"…"`, `b"…"` and `@bytes"…"`, `s"…"` and `@symbol"…"`, `e{…}` and
  `@error{…}`. The short letter is immediately followed by `"` or `{`. Both
  spellings MUST project the same `date`, `bytes`, `symbol`, or `error` tag.
- Set MUST accept only `@set[…]`. A one-letter set tag MUST be rejected.
- Whitespace/comments MUST be accepted inside containers and between a long tag
  name and its payload.
- It MUST reject commas, missing separators, multiple top-level values,
  expression interpolation, calls, imports, unknown tags, a short letter other
  than `b`, `s`, `e`, or `d`, and `@meta`.
- Raw controls, unknown string escapes, incomplete unicode escapes, leading-zero
  numbers, incomplete fractions/exponents and incomplete containers MUST fail.
- Documented required-element failures MUST report the corresponding position
  and explanation; decoding MUST NOT execute application expressions.

Postconditions:

- Raw number/string token AST values retain source digits/escapes for fixed
  native reconstruction. Parsing alone does not claim native-type construction.
- Tests: `src/lang_tests/common.rs`.

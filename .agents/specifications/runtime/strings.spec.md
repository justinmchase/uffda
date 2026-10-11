# Runtime strings

This chapter defines lossless string contents and their host/text boundaries. It
preserves the existing language's UTF-16 semantics independently of the host
runtime.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted as
described in RFC 2119 and RFC 8174 when they appear in all capitals.

## Definitions

- A string is an ordered sequence of UTF-16 code units, including isolated
  surrogate code units.
- A code-point iteration item consists of a matching high/low surrogate pair or
  one code unit when no such pair is present.
- A scalar host string contains only valid Unicode scalar values.

## Axioms

- String contents MUST NOT be normalized or repaired implicitly.
- Equality and ordering MUST compare UTF-16 code-unit sequences.
- An isolated surrogate MUST NOT become a replacement character or disappear.

## Constraints

### Operations

- Length, indexing and slicing MUST use UTF-16 code units.
- Iteration MUST preserve matching surrogate pairs as one item and isolated
  surrogates as individual items.
- Concatenating isolated high and low surrogates MUST preserve their units and
  allow subsequent iteration to recognize the resulting pair.
- Property keys, AST literal segments and runtime values MUST preserve the same
  contents. Provenance MUST follow the existing operation-specific contracts.

### Text boundaries

- Constructing runtime text from a scalar host string MUST preserve all its
  UTF-16 units.
- Converting runtime text to a scalar host string MUST fail explicitly when
  isolated surrogates are present; lossy conversion MUST NOT be the default.
- JSON string decoding MUST preserve `\uXXXX` units, including isolated
  surrogates. Encoding MUST escape isolated surrogates so its output is valid
  UTF-8 and can be decoded without information loss.
- Structural JSON ingestion and serialization MUST preserve these contents in
  nested values and object keys. Typed AST decoding MUST operate on that
  lossless structure; scalar-only intermediate JSON values MUST NOT be used to
  ingest arbitrary runtime text.
- Scalar-only source display and host operations MUST report encoding errors
  rather than emit source syntax that changes isolated surrogates on reparse.
- JSON string decoding MUST reject malformed escapes, unescaped controls,
  missing closing quotes and trailing input with source byte locations.
- An explicit WTF-8 host boundary MAY carry surrogate code units. It MUST
  validate its encoding and remain distinct from scalar UTF-8 conversion.

## Mechanism

Implementations MAY store UTF-16 units directly or use an equivalent lossless
encoding. Public host boundaries must distinguish runtime strings from scalar
host strings. A lossless primitive alone does not complete migration: AST/data
ingestion, values, property keys, native functions and output must use it
consistently before the string compatibility gate is complete.

## Why this design

Rust `String` cannot represent isolated surrogates produced by existing indexing
and slicing behavior. Silently replacing them changes equality, property lookup
and round trips. A separate lossless string boundary avoids relying on
JavaScript-specific storage while preserving the language's observable behavior.

# Data codec v1 values

This chapter defines the safe value syntax layered over
[record framing](../data-codec.spec.md). No expression evaluation, imports or
callable lookup are part of decoding.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted as
described in RFC 2119 and RFC 8174 when they appear in all capitals.

## Syntax

- A record MUST contain exactly one value with optional surrounding whitespace
  and hash comments. Whitespace is ASCII space, tab, CR or LF. Adjacent values
  in arrays and object entries MUST have at least one whitespace character or
  comment between them; commas are not accepted.
- Scalars are `null`, `undefined`, `true`, `false`, JSON-form finite numbers,
  `NaN`, `Infinity`, `-Infinity`, decimal integers suffixed by `n`, and quoted
  strings. Negative zero MUST preserve its sign. Numeric overflow MUST fail, not
  produce infinity.
- Quoted strings MUST use JSON string escapes, without interpolation. Escaped
  surrogate units MUST round-trip without replacement.
- Arrays are `[value value]`. Objects are `{key:value key:value}`. Keys MAY be
  JSON quoted strings or ASCII identifiers matching `[A-Za-z_][A-Za-z_0-9]*`.
  Duplicate object keys MUST fail rather than overwrite. Own keys including
  `__proto__` are ordinary data keys.
- Tags are fixed spellings, not names resolved from an environment:
  `@date"timestamp"`, `@bytes"base64url"`, `@symbol"registry-key"`,
  `@set[value value]`, `@map[[key value] [key value]]`, and
  `@error{name:"Error" message:"description"}`. Whitespace MAY separate a tag
  from its payload.
- Dates MUST be valid RFC3339 timestamps representing a millisecond-precision
  instant. Bytes MUST use canonical unpadded base64url. Symbols MUST be global
  registry symbols, not newly allocated local symbols. Map entries MUST each
  contain exactly two values; duplicate map keys and set entries MUST fail under
  runtime equality. Errors MUST have string `name` and `message`, and MAY have
  data `cause` and string `stack`; unknown fields fail.
- Unknown tags, executable syntax and multiple values per record MUST fail. V1
  has no metadata header. `@meta` MUST NOT be treated specially.

## Identity and reconstruction

The codec serializes trees of data values, not arbitrary object graphs. Cycles
and repeated composite references MUST fail encoding, even when acyclic, rather
than silently lose alias identity. Local symbols, callable values and execution
handles MUST fail encoding. Decoding MUST construct only the fixed native types
above; unsupported native construction MUST fail explicitly.

Decoded values MUST materialize as genuine runtime-native values in the
collector arena. BigInt is a value-equal primitive; Date and Error use object
identity. Error causes remain traced runtime references. Encoding runtime values
MUST iteratively walk the reachable graph, preserve insertion order, and reject
aliases, cycles, unsupported values and out-of-contract date precision.
Materialization and export MUST not retain unrooted arena values across a
collection boundary.

The ordinary JSON serializer MUST reject BigInt, serialize Date as its UTC
RFC3339 instant, and serialize an Error with no enumerable user properties as an
empty object. The data codec is the lossless representation for those values.
Project files, lockfiles, and diagnostic JSON remain JSON. Compiled
ModuleDeclarations use the data codec on disk with the **`.uff.ast`** extension
(see
[compiled ModuleDeclaration artifacts](../data-codec.spec.md#compiled-moduledeclaration-artifacts));
a `.uff.ast.json` sibling may exist during migration.

## Encoding and diagnostics

Compact encoding MUST produce one physical line. Pretty encoding MAY indent
containers across lines without changing values. Strings MUST escape controls,
quotes, backslashes and isolated surrogate units. Encoding MUST be
deterministic, preserve object/map insertion order and never implicitly invoke
conversion hooks.

The authored grammar MUST produce a validated structural AST with distinct
scalar, array, object and tag variants. Number and quoted-string tokens MAY
remain raw until fixed native conversion, preserving all input digits/escapes.
Required closing delimiters, colons, operands and escapes MUST have focused
source diagnostics. Duplicate-key and invalid native payload diagnostics MAY
come from the fixed construction boundary. Decoding/encoding MUST enforce
explicit depth and record-size limits without unbounded host recursion.

Streaming value decoding MUST be independent of language loading, artifact
resolution and expression execution so that compiled languages can themselves be
decoded from codec records. A native parser MUST accept the same syntax and
construct the same values as the authored grammar plus fixed construction,
including lossless UTF-16 strings and native payload validation. The authored
grammar remains the syntax and source-diagnostic oracle; native parse failures
MUST include a byte position.

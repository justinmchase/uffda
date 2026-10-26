---
id: data-codec-005
title: Codec decoding and embedded declarations are independent of language loading
spec_ref: ".agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics; .agents/specifications/data-codec.spec.md#compiled-moduledeclaration-artifacts"
---

# Native codec artifact cutover

## Requirement

Preconditions:

- A published compiler has emitted `.uff.ast` ModuleDeclaration artifacts.

Expected behavior:

- Value decoding MUST work without embedded languages, filesystem grammar reads,
  a resolver, or expression execution.
- The native parser MUST agree with the authored grammar plus fixed native
  construction on accepted values, rejected syntax and canonical encoding.
- Parsing MUST be iterative, enforce byte/depth limits, preserve UTF-16 units,
  and share native payload validation with authored-AST construction.
- Declaration decoding MUST consume the entire input and reject empty input,
  trailing invalid input and multiple records, including after a newline.
- Product embedding MUST copy unmodified `.uff.ast` records, with no JSON seed
  or fallback. Missing codec artifacts MUST fail with bootstrap guidance.
- Filesystem, package-root, registry resolution, and product embedding MUST
  accept only `.uff.ast` declarations and MUST NOT load JSON declarations or
  fall back to legacy JSON/`.uffda.ast` siblings. Compile MUST emit only
  `.uff.ast`.
- A missing, invalid, or corrupt codec artifact MUST fail explicitly.
  Registry artifacts listed in the manifest MUST surface download and
  integrity failures.

Postconditions:

- Embedded language graphs can load and the compiler can recompile all authored
  languages without loading JSON declarations to bootstrap codec decoding.
- Tests: `src/codec_runtime/data/tests.rs`, `src/codec/src/data/parser.rs`,
  `src/codec_runtime/declaration.rs`, `src/builtins.rs`,
  `tests/build.rs`, `src/resolver.rs`,
  `src/resolver/packages/tests.rs`.

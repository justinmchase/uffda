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
- Filesystem, package-root and registry resolution MUST prefer `.uff.ast` over
  `.uff.ast.json`. JSON-only dependencies and explicit JSON declarations MUST
  remain supported. Compile MUST continue to emit both siblings.
- A present codec artifact with invalid encoding or declarations MUST fail
  rather than silently load a valid JSON sibling. Registry artifacts listed in
  the manifest MUST surface download and integrity failures, not fall back.

Postconditions:

- Embedded language graphs can load and the compiler can recompile all authored
  languages without loading JSON declarations to bootstrap codec decoding.
- Tests: `rust/src/codec/data/tests.rs`, `rust/src/codec/data/parser.rs`,
  `rust/src/codec/declaration.rs`, `rust/src/builtins.rs`,
  `rust/tests/build.rs`, `rust/src/resolver.rs`,
  `rust/src/resolver/packages/tests.rs`.

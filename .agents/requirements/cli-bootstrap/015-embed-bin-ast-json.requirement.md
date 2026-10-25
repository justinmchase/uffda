---
id: cli-bootstrap-015
title: Published Rust CLI embeds ./bin codec artifacts via uffda-build
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#bootstrap-definition"
---

# Embed Bin Artifacts In Standalone CLI

## Requirement

Preconditions:

- Converted language modules exist as authored `.uff` under `src/lang/`.
- `compile:lang` produces mirrored `.uff.ast` codec records under `./bin/`.

Expected behavior:

- `npm run compile:cli` MUST run `compile:lang` before building the Rust
  product CLI with `embed-languages`, so the compiled codec files are embedded
  by `uffda-build`.
- `.github/workflows/release-binaries.yml` MUST compile language modules into
  `./bin` in `compile-lang`, then the `compile-rust` job MUST build the Rust
  `uffda` binary with that tree present so the artifacts are embedded. Release
  assets MUST be named `uffda-<version>-<target>`. The job MUST NOT run
  `deno compile` or publish `uffdar-*` assets.
- When attaching release assets, the workflow MUST download only CLI target
  artifacts (`uffda-*`) and MUST NOT upload the language `./bin` tree to the
  GitHub Release.
- Standalone and in-tree product CLI builds MUST load built-in grammars from
  embedded declarations, independently of the consumer process cwd or external
  workspace artifacts. Remote grammar packages MUST resolve artifacts relative
  to their package root through the ordinary Rust package resolver.
- Checks bootstrap compile MUST install a published CLI via `uffda-setup`
  (normally `latest`; pin a SemVer only when recovering from a bad release).
- The release `compile-lang` job MUST NOT install or run Deno. It MUST download
  the latest published CLI asset with `gh`, seed `./bin` with that binary, then
  rewrite `./bin` with the Rust `uffda compile`.
- The Rust CLI MUST embed the unmodified published-compiler declaration bytes
  and MAY decode them lazily through the ordinary resolver. Registering embedded
  modules MUST NOT require decoding unused declarations; first access MUST
  validate and cache the declaration without file reads or re-lowering.

Postconditions:

- Published CLI binaries compile authored `.uff` using embedded `./bin` codec
  records.
- Converted modules stay off `builtInLanguageDeclarations` (no host twins).

## Test plan

- `src/builtins.rs`, `src/resolver.rs`, `tests/build.rs`

---
id: cli-bootstrap-001
title: Compiled language artifacts land under bin
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/compiler-bootstrap.spec.md#composition-intent"
---

# Bin Artifact Layout

## Requirement

Preconditions:

- Uffda language and CLI sources are authored as `.uff` modules for
  self-hosting.

Expected behavior:

- Compiling those sources with the Uffda CLI MUST emit deterministic JSON
  artifacts under `./bin/`.
- The next CLI binary MUST load language definitions from those `./bin/`
  artifacts for the compiled product.

Postconditions:

- Released Rust CLI binaries embed compiled `./bin` codec records via
  `uffda-build` with `embed-languages` and resolve logical `.uff` imports from
  that embedded tree when running as a standalone product.
- Authors import compiled modules with `import "./foo.uff"` once artifacts exist
  under the configured root (see `cli-bootstrap-004`).

## Status

All 70 language modules are authored as `.uff` and loaded from compiled
artifacts. The full-circle bootstrap gate passes in Checks; the Deno reference
implementation and TypeScript language wrappers are retired.

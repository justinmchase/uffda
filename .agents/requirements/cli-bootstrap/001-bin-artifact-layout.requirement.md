---
id: cli-bootstrap-001
title: Compiled language artifacts land under bin
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
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

- Released CLI binaries do not depend on TypeScript language module sources for
  language definitions.
- Authors import compiled modules with `import "./foo.uff"` once artifacts exist
  under the configured root (see `cli-bootstrap-004`).

## Status

Milestone 11 in progress. Authored modules so far:
`src/lang/common/characters/digit.uff` and
`src/lang/common/characters/connecting.uff`; remaining language modules still
load from TypeScript until conversion completes.

---
id: cli-bootstrap-002
title: Full-circle compile-self validation gates bootstrap
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#full-circle-validation-requirements; .agents/specifications/languages/compiler-bootstrap.spec.md#composition-intent"
---

# Full-Circle Compile-Self Tests

## Requirement

Preconditions:

- CLI version N can compile the Uffda `.uff` source tree into `./bin/`
  artifacts.

Expected behavior:

- Bootstrap tests MUST compile the source tree with CLI N, then use the
  resulting artifacts (or a CLI built from them) to compile the same source tree
  again.
- The second compile MUST succeed for the fixed source tree and configuration.
- Additional regression tests over compiled outputs SHOULD run before packaging
  those outputs into a CLI binary.

Postconditions:

- Self-hosting progression cannot advance on a one-shot compile that cannot
  reproduce itself.

## Status

Implemented in Checks and Release Binaries: the published CLI compiles the
language sources, then a Rust CLI built from those artifacts recompiles the same
sources. Checks uploads the second compile's artifacts for the Rust test jobs.

Tests: `.github/workflows/checks.yml` (`rust-language-bin` job);
`.github/workflows/release-binaries.yml` (`compile-lang` job).

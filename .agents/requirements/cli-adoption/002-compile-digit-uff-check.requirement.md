---
id: cli-adoption-002
title: Checks compile the first authored .uff language module
spec_ref: ".agents/specifications/languages/cli.spec.md#milestone-10-ci-adopts-the-published-cli-and-release-gates; .agents/specifications/languages/compiler-bootstrap.spec.md#bootstrap-definition; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
---

# Compile Digit Uff Check

## Requirement

Preconditions:

- `src/lang/common/characters/digit.uff` is an authored Uffda source for the
  Digit language module.
- The Checks workflow has installed an Uffda CLI.

Expected behavior:

- Checks MUST compile `digit.uff` with `uffda compile` into `./bin/`.
- The compile MUST emit a deterministic AST JSON artifact under `./bin/ast/`.
- Until a published CLI includes deno-compile-safe language declaration loading,
  Checks MAY fall back once to the in-tree CLI for the same compile command.

Postconditions:

- CI proves the published CLI install path can drive language-module
  compilation, starting with one converted module.

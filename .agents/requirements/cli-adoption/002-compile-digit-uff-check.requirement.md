---
id: cli-adoption-002
title: Checks compile the first authored .uff language module
spec_ref: ".agents/specifications/languages/cli.spec.md#milestone-10-ci-adopts-the-published-cli-and-release-gates; .agents/specifications/languages/compiler-bootstrap.spec.md#bootstrap-definition; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
---

# Compile Digit Uff Check

## Requirement

Preconditions:

- `src/lang/common/characters/digit.uff` (and other Phase 0 character `.uff`
  sources such as `connecting.uff`, `formatting.uff`, and `letter.uff`) are
  authored Uffda sources.
- The Checks workflow has installed an Uffda CLI.

Expected behavior:

- Checks MUST compile those `.uff` sources with the installed `uffda compile`
  into `./bin/` (not the in-tree Deno CLI entrypoint).
- The compile MUST emit deterministic AST JSON artifacts under `./bin/ast/`.

Postconditions:

- CI proves the published CLI install path can drive language-module
  compilation, starting with converted Phase 0 character modules.

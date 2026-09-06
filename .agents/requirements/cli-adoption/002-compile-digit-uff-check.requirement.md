---
id: cli-adoption-002
title: Checks compile authored language .uff modules into bin
spec_ref: ".agents/specifications/languages/cli.spec.md#milestone-10-ci-adopts-the-published-cli-and-release-gates; .agents/specifications/languages/compiler-bootstrap.spec.md#bootstrap-definition; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
---

# Compile Language Uff Check

## Requirement

Preconditions:

- Phase 0 character `.uff` sources under `src/lang/common/characters/` are
  authored Uffda sources.
- The Checks workflow has installed an Uffda CLI.

Expected behavior:

- Checks MUST compile language `.uff` sources with the installed `uffda compile`
  into `./bin/` using a quoted glob such as `'src/lang/**/*.uff'` (not the
  in-tree Deno CLI entrypoint).
- The compile MUST emit deterministic AST JSON artifacts under `./bin/ast/`.

Postconditions:

- CI proves the published CLI install path can drive language-module compilation
  for converted Phase 0 character modules.

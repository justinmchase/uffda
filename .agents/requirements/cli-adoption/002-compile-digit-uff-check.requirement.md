---
id: cli-adoption-002
title: Checks compile authored language .uff modules into bin
spec_ref: ".agents/specifications/languages/cli.spec.md#milestone-10-ci-adopts-the-published-cli-and-release-gates; .agents/specifications/languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
---

# Compile Language Uff Check

## Requirement

Preconditions:

- Phase 0 character `.uff` sources under `src/lang/common/characters/` are
  authored Uffda sources.
- The Checks workflow installs a published Uffda CLI and can run
  `deno task compile:lang`.

Expected behavior:

- Checks MUST compile language `.uff` sources into `./bin/` via
  `deno task compile:lang`.
- That task MUST use the previous published `uffda compile` for parse, then the
  compile-pipeline lower stage to ModuleDeclaration JSON.
- The compile MUST emit deterministic ModuleDeclaration JSON artifacts under
  `./bin/ast/`.

Postconditions:

- CI proves language-module compilation produces resolvable `./bin` artifacts
  without recursive compiler import.

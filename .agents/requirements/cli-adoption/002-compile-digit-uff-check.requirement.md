---
id: cli-adoption-002
title: Checks compile authored language .uff modules into bin
spec_ref: ".agents/specifications/languages/cli.spec.md#status; .agents/specifications/languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break; .agents/specifications/languages/compiler-bootstrap.spec.md#composition-intent"
---

# Compile Language Uff Check

## Requirement

Preconditions:

- Phase 0 character `.uff` sources under `src/lang/common/characters/` are
  authored Uffda sources.
- The Checks workflow installs a published Uffda CLI through `uffda-setup`.

Expected behavior:

- Checks MUST compile language `.uff` sources into `./bin/` by clearing `./bin`
  and running `uffda compile 'src/lang/**/*.uff'` with that published CLI.
- That command MUST be the previous published `uffda compile` for parse, then
  the compile-pipeline lower stage to ModuleDeclaration JSON. It is the same
  invocation as `compile:lang`, without a Deno task runner.
- The compile MUST emit deterministic ModuleDeclaration JSON artifacts under
  `./bin/ast/`.

Postconditions:

- CI proves language-module compilation produces resolvable `./bin` artifacts
  without recursive compiler import.
- Tests: `src/cli/requirement_ports.rs`.

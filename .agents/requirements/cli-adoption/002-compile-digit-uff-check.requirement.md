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
- The Checks workflow has installed an Uffda CLI (for version reporting and for
  compile once a repair release is published).

Expected behavior:

- Checks MUST compile language `.uff` sources into `./bin/` using a quoted glob
  such as `'src/lang/**/*.uff'`.
- During the 0.1.4 bootstrap-repair window (`.uff` imports without `.uff`-keyed
  registry entries), Checks MAY compile with the in-tree CLI. After the repair
  release ships, Checks MUST use installed `uffda compile`.
- The compile MUST emit deterministic AST JSON artifacts under `./bin/ast/`.

Postconditions:

- CI proves language-module compilation into `./bin/` for converted Phase 0
  character modules.

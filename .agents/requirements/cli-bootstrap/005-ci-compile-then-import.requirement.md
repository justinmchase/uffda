---
id: cli-bootstrap-005
title: CI compile-then-import gate for Digit .uff
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/modules.spec.md#uffda-source-imports-uff; .agents/specifications/languages/cli.spec.md#milestone-10-ci-adopts-the-published-cli-and-release-gates"
---

# CI Compile-Then-Import Gate

## Requirement

Preconditions:

- Checks has installed an Uffda CLI (published preferred) and compiled
  `src/lang/common/characters/digit.uff` into `./bin/`.
- The expected artifact
  `./bin/ast/src/lang/common/characters/digit.uffda.ast.json` exists.

Expected behavior:

- A bootstrap integration test MUST import the logical Digit `.uff` URL with a
  Resolver configured for repo `cwd` and `artifactRoot` `./bin`.
- That import MUST succeed and MUST export `Digit`.
- The test MUST NOT recompile; it validates the workflow-produced `./bin` tree.

Postconditions:

- CI proves compile emission and `.uff` remapping agree on the product artifact
  layout before language modules switch to importing `.uff`.

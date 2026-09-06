---
id: cli-bootstrap-007
title: Authored .uff sources stay within the published CLI feature surface
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#published-compiler-feature-surface; .agents/specifications/languages/uff-module-conversion-plan.md#bootstrap-compiler-constraint"
---

# Published CLI Feature Surface For Authored Uff

## Requirement

Preconditions:

- Bootstrap compiles language `.uff` sources with the latest published Uffda CLI
  (version N).
- In-tree sources may already contain unreleased language or std changes for
  version N+1.

Expected behavior:

- Authored `.uff` modules under `src/lang/` that Checks (or `deno task
  compile:lang`) compiles MUST be accepted by that published `uffda compile`.
- Those compile steps MUST invoke the installed published CLI with a quoted glob
  such as `'src/lang/**/*.uff'` (CLI expands paths in-process; not shell
  globstar, and not `./src/cli/main.ts`).
- A module MUST NOT be converted to `.uff` until every construct it needs is
  available in the published CLI feature surface (G0).
- Converted `.uff` leaves that the grammar imports MUST remain registered under
  their logical `.uff` URLs in `builtInLanguageDeclarations` (via
  `*.bootstrap.ts`) so a published CLI can compile without a pre-existing
  `./bin`.

Postconditions:

- Self-hosting conversion cannot race ahead of published language-feature
  capability.
- New syntax/std must publish before dependent `.uff` conversion.

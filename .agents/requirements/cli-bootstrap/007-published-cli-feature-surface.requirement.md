---
id: cli-bootstrap-007
title: Authored .uff sources stay within the published CLI feature surface
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#published-compiler-feature-surface; .agents/specifications/languages/uff-module-conversion-plan.md#bootstrap-compiler-constraint"
---

# Published CLI Feature Surface For Authored Uff

## Requirement

Preconditions:

- Bootstrap compiles language `.uff` sources with the latest published Uffda CLI
  (version N), except during a documented bootstrap-repair window.
- In-tree sources may already contain unreleased language or std changes for
  version N+1.

Expected behavior:

- Authored `.uff` modules under `src/lang/` MUST be accepted by the compiler
  used for bootstrap compile (`uffda compile` or, during repair, the in-tree CLI
  with the same argv/glob surface).
- Compile inputs SHOULD use a quoted glob such as `'src/lang/**/*.uff'` so the
  CLI expands paths in-process.
- A module MUST NOT be converted to `.uff` until every construct it needs is
  available in the published CLI feature surface (G0), even when a repair
  compile temporarily uses the in-tree CLI.
- Converted `.uff` leaves that the grammar imports MUST remain registered under
  their logical `.uff` URLs in `builtInLanguageDeclarations` (via
  `*.bootstrap.ts`) so a published CLI can compile without a pre-existing
  `./bin`.

Postconditions:

- Self-hosting conversion cannot race ahead of published language-feature
  capability.
- After a repair release that includes `.uff`-keyed bootstrap registry entries,
  Checks and `compile:lang` MUST return to the installed `uffda` path.

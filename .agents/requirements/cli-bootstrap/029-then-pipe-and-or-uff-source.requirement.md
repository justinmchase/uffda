---
id: cli-bootstrap-029
title: Then, Pipe, And, and Or modules have authored .uff source (B4)
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Then / Pipe / And / Or Uff Sources (B4)

## Requirement

Preconditions:

- Pattern stack leaves used by these modules (`prefix`, `projection`) may remain
  TypeScript.
- Std provides `flat` and `one` for assembling and collapsing pattern lists.

Expected behavior:

- Length-1 collapse (blocker B4) MUST use std `one` with `Tail*` quantifiers,
  not Native `patterns.length === 1 ? p : wrapper`.
- Authors MUST NOT use `Tail+ | child` for these four modules: they participate
  in the PatternLang import cycle, where that shape fails under left recursion.
- `src/lang/pattern/then.uff` MUST export `Then` projecting
  `(one (flat _) "then")`.
- `src/lang/pattern/pipe.uff` MUST export `Pipe` projecting
  `(one (flat _) "pipeline" "steps")`.
- `src/lang/pattern/and.uff` MUST export `And` projecting
  `(one (flat _) "and")`.
- `src/lang/pattern/or.uff` MUST export `Or` with optional leading `|` and
  `(one (flat _) "or")`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- Conversion-plan blocker B4 is closed for these four modules.

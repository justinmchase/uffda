---
id: cli-bootstrap-029
title: Then, Pipe, And, and Or modules have authored .uff source (B4)
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Then / Pipe / And / Or Uff Sources (B4)

## Requirement

Preconditions:

- Pattern stack leaves used by these modules are authored as `.uff` (`prefix`,
  `projection`, `resolve`, `structure`, `literals`).
- Std provides `flat` and `one` for assembling and collapsing pattern lists.

Expected behavior:

- Length-1 collapse (blocker B4) MUST use std `one` with `Tail*` quantifiers,
  not Native `patterns.length === 1 ? p : wrapper`. The member list (including
  any comment nodes between members, see
  `.agents/specifications/languages/pattern-syntax/grammar.spec.md`) is captured
  flat as `m`, then collapsed with `(one m { kind: "and", patterns: m })` — when
  the list has one element return it; otherwise return the full wrapper
  (parameter two).
- Authors MUST NOT use `Tail+ | child` for these four modules: they participate
  in the PatternLang import cycle, where that shape fails under left recursion.
- `src/lang/pattern/then.uff` MUST export `Then` projecting
  `(one m { kind: "then", patterns: m })`.
- `src/lang/pattern/pipe.uff` MUST export `Pipe` with optional leading `|>` and
  `(one m { kind: "pipeline", steps: m })`.
- `src/lang/pattern/and.uff` MUST export `And` projecting
  `(one m { kind: "and", patterns: m })`.
- `src/lang/pattern/or.uff` MUST export `Or` with optional leading `|` (not when
  followed by `>`, which begins a leading `|>`) and
  `(one m { kind: "or", patterns: m })`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- Conversion-plan blocker B4 is closed for these four modules.

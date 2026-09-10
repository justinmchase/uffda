# Uffda language module → `.uff` conversion plan

Status: living plan. Convert **one module at a time**. Before each conversion,
re-check the three gates below and record the outcome in the per-module section
(or a follow-up PR note). Conversion **replaces** the `.ts` module: dependents
import the `.uff` URL, registry entries for that module are dropped, and the
`.ts` file is deleted once `.uff` → `./bin` remapping works in tests and CI.

## End state

**Every** module under `src/lang/` that today is a TypeScript
`ModuleDeclaration` MUST eventually be authored `.uff` loaded from `./bin`,
including stack roots and language entry modules:

- Expression stack through `expression/expression.lang`
- Pattern stack through `pattern/pattern.lang`
- Tokenizer stack through `tokenizer/mod`, `tokenizer/structured`, and
  `tokenizer/tokenizer.lang`
- Uffda surface through `uffda/*.rules` and `uffda/uffda.lang`
- Remaining leaves (`source/mod`, etc.) once their blockers (B6+) ship

Temporary TypeScript bridges are allowed only while a parent still imports an
unconverted child. Permanent host-only language modules are not the goal; when a
module needs spans/checksums/walks, add std or pattern surface (B6/B7) and then
convert.

CLI baseline for this effort: **latest published** `uffda` (see Releases), with
compile-then-import on `main`.

## Bootstrap compiler constraint

Compile always uses the **latest published** CLI (version N), never the in-tree
CLI. Authored `.uff` MAY use only features that CLI N already accepts (syntax,
character classes, projections, std, imports, etc.). In-tree language/runtime
work for N+1 does not unlock `.uff` authoring until it ships.

See
[Published-compiler feature surface](./compiler-bootstrap.spec.md#published-compiler-feature-surface).

## Conversion gates (must pass in `.ts` first)

Before authoring `.uff` for a module, the TypeScript `ModuleDeclaration` MUST
already satisfy:

### G0 — Published CLI surface

- The intended `.uff` text MUST stay within the installed latest published CLI
  feature surface (syntax / std / forms already in version N).
- Produce `./bin` via `deno task compile:lang` (parse → previous published
  compiler → ModuleDeclaration). Prefer published `uffda compile` once that CLI
  includes the same pipeline.
- Do not author against unreleased PatternLang / ExpressionLang / std changes.
- If a needed feature is missing from N, ship it in a release first, then
  convert.

### G1 — Pattern surface

- Every pattern used by the module MUST be expressible in PatternLang / Uffda
  pattern syntax (or be replaced by an equivalent that is).
- No reliance on runtime-only pattern forms without syntax (`RegExp`, etc.).
- Problematic sugar (optional-array unwrap, reserved-name lists, parametric
  rules) MUST have an agreed syntax or an agreed rewrite in `.ts` first.

### G2 — Expression / std surface

- Projections MUST be expressible without `ExpressionKind.Native` JS `fn`
  (compiled `./bin` AST cannot carry host functions).
- Allowed projection shapes: object/array/string/number/boolean literals,
  references, members, invocations of **std** (or other declared callables).
- If a Native calls something not in std (`parseInt`, `flat`, span/hash helpers,
  `throw`), either add std, reshape the pattern so projection is trivial, or
  keep the module host-side (blocked).

### G3 — Projection vs parsing (critical)

Expressions MUST **project** matched values into AST/values. They MUST NOT
re-implement matching/parsing that belongs in patterns:

| Smell in Native                                                            | Prefer                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Split / scan / classify strings                                            | Character / equal / into / quantifier patterns                                                                   |
| Inspect object shape / discriminators to “parse”                           | `over {…}`, typed into, resolve rules                                                                            |
| Conditional structure from “what matched” when patterns could discriminate | Separate alternatives with distinct projections                                                                  |
| Walk match trees / spans                                                   | Pattern pipeline that already yields structured values                                                           |
| Collect segments then left-fold in Native / `reduce` / `for`               | Direct left recursion (or equivalent pattern fold); see [map/reduce idioms](./pattern-idioms-map-reduce.spec.md) |

Identity `({ _ }) => _` and pure AST wrappers
`({ pattern }) => ({ kind: "not", pattern })` are projections (OK once Native is
replaced). `_.flat().join("")`, `parseInt`, match-span indexing are usually
**not** ready until G2/G3 are fixed in `.ts`.

### Additional gates

- **G4 — Imports:** Prefer `ImportDeclarationKind.Module` with `.uff` URLs once
  children are converted; eliminate `ImportDeclarationKind.Native` embeds.
- **G5 — Artifacts only:** Converted `.uff` modules MUST NOT retain TypeScript
  twins or `*.bootstrap.ts` host stubs in the in-tree registry. Compiler output
  JSON MUST NOT be committed under `src/` (only under `./bin/` via
  `compile:lang`). Compile is one pipeline (parse → previous published compiler
  → ModuleDeclaration); no finalize/seed under `src/`. If the published CLI
  lacks a needed feature, publish a new CLI and compile with it. The published
  CLI (N) embeds `./bin` ModuleDeclaration JSON via `deno compile --include` and
  remaps logical `.uff` URLs from the binary extract root; in-tree runtime loads
  from workspace `./bin` after `compile:lang`.
- **G6 — Tests:** Existing `*.test.ts` must keep passing; add compile +
  `.uff`-import smoke where useful.
- **G7 — CI:** Extend Checks compile-then-import as modules land under `./bin`.

## Global blockers (shared workstreams)

These unlock many modules; schedule explicitly rather than rediscovering per
file:

| ID  | Blocker                                                      | Needed by                                                                | Direction                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Replace Native with serializable projections                 | ~45 modules                                                              | ExpressionLang object/invocation forms + std                                                                                                                                          |
| B2  | List flatten + join (`_.flat().join("")`)                    | identifier (done), string (done), import.rules (done), tokenizer, rules  | std `flat`/`join` — shipped                                                                                                                                                           |
| B3  | Digit string → number                                        | expression/number (done)                                                 | std `int` shipped with number.uff                                                                                                                                                     |
| B4  | Length-1 list collapse (`patterns.length===1 ? p : wrapper`) | then/pipe/and/or (done)                                                  | Closed via `(one list full)` + `Tail*` (not `Tail+\|child`; unsafe under PatternLang LR)                                                                                              |
| B5  | Quantifier optional-array unwrap                             | many                                                                     | `(flat (coalesce k []))` / star rewrite; more sugar later                                                                                                                             |
| B6  | Host match spans / checksum / line index                     | source/mod, tokenizer                                                    | New std/host builtins — then convert (not permanent hybrid)                                                                                                                           |
| B7  | Match-tree semantic text walk                                | tokenizer.lang                                                           | Same as B6 — required before tokenizer.lang `.uff`                                                                                                                                    |
| B8  | Validation `throw` in projection                             | prefix bounds                                                            | Closed: Star arms + runtime Quantifier; no Native throw                                                                                                                               |
| B9  | Pattern stack import cycles                                  | resolve/structure ↔ pattern                                              | Closed: convert as a layer; `.uff`↔`.uff` cycle OK via Resolver cache; Atomic retargeted                                                                                              |
| B10 | Parametric rules (`Surround<L,P,R>`, `Token<P>`)             | surround, token                                                          | Declaration syntax shipped in 0.1.11                                                                                                                                                  |
| B11 | PatternLang + ExpressionLang string escapes (`\t`, `\n`, …)  | whitespace, newLine (done)                                               | Shipped; expression escapes enable `-> "\n"`                                                                                                                                          |
| B12 | Multi-letter variable bindings in PatternLang                | readable `.uff` (esp. `*.lang`)                                          | Published CLI today accepts only single-letter `name:P`                                                                                                                               |
| B13 | Expression string proj of `"{"` / `"}"`                      | object braces, string escapes                                            | `-> "{"` parses as object literal; use bare Equal, `-> _`, or bind `c:"{" -> c`                                                                                                       |
| B14 | Left-fold over lists without domain helpers                  | expression/member (done), similar AST folds                              | DLR + nested [Projection](../../patterns/runtime/projection.spec.md); closed for Member (not std `reduce`+lambda; sugar later [#98](https://github.com/justinmchase/uffda/issues/98)) |
| B15 | `"\\"` in multi-rule `.uff` modules                          | expression/string (done)                                                 | Rule-body quote scanner treats `\\` as escapable; shipped in 0.1.15                                                                                                                   |
| B16 | `.uff` load → runtime compiler                               | `uffda/runtime.compiler`                                                 | Closed: compile emits ModuleDeclarations to `./bin`; Resolver.import loads JSON only; host uses Resolver.import on `.uff`.                                                            |
| B17 | Contextual `$name` ValueSource                               | literals equal/between/includes; prefix `P*$n`; relational object checks | Closed for `$name`; open between + prefix digit StarMinMax (`$n..`) shipped                                                                                                           |

## Phase order (dependency leaves first)

Convert in this order. **Stop before each module** for human review of G1–G3.

### Phase 0 — Character leaves (prove `.uff` + bin + import)

| # | Module                         | G1                    | G2             | G3                  | Notes                                      | Ready? |
| - | ------------------------------ | --------------------- | -------------- | ------------------- | ------------------------------------------ | ------ |
| 0 | `common/characters/digit`      | OK `\cNd`             | none           | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 1 | `common/characters/connecting` | OK `\cPc`             | none           | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 2 | `common/characters/formatting` | OK `\cCf`             | none           | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 3 | `common/characters/letter`     | OK `\cL\|\cNl`        | none           | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 4 | `common/characters/combining`  | OK `\cMn\|\cMe\|\cMc` | none           | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 5 | `common/characters/whitespace` | OK                    | none (dropped) | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 6 | `common/characters/newLine`    | OK                    | `-> "\n"`      | OK project constant | Replaced `.ts`; loads via `.uff` → `./bin` | done   |
| 7 | `common/characters/mod`        | n/a                   | n/a            | n/a                 | Replaced `.ts`; loads via `.uff` → `./bin` | done   |

### Phase 1 — Common helpers

| #  | Module              | G1          | G2                   | G3                       | Ready? |
| -- | ------------------- | ----------- | -------------------- | ------------------------ | ------ |
| 8  | `common/identifier` | OK          | `(join (flat _) "")` | Projection of chars (OK) | done   |
| 9  | `common/surround`   | OK (params) | `-> p`               | OK                       | done   |
| 10 | `tokenizer/token`   | OK          | none                 | OK                       | done   |
| 11 | `common/spread`     | OK          | none                 | OK                       | done   |

### Phase 2 — Expression stack (bottom-up)

| #  | Module                       | G1       | G2                         | G3                                   | Ready? |
| -- | ---------------------------- | -------- | -------------------------- | ------------------------------------ | ------ |
| 12 | `expression/number`          | OK       | `(int (join (flat _) ""))` | Digits matched by pattern; `int` std | done   |
| 13 | `expression/boolean`         | OK       | object proj                | OK                                   | done   |
| 14 | `expression/nullish`         | OK       | Value proj                 | OK                                   | done   |
| 15 | `expression/reference`       | OK       | Reference wrap             | OK                                   | done   |
| 16 | `expression/terminal`        | OK       | identity                   | OK                                   | done   |
| 17 | `expression/not`             | OK       | Not wrap                   | OK                                   | done   |
| 18 | `expression/array`           | OK       | Array AST proj             | OK                                   | done   |
| 19 | `expression/object`          | OK       | Object AST proj            | OK (`flat` unwrap)                   | done   |
| 20 | `expression/sequence`        | OK       | Invocation AST             | OK                                   | done   |
| 21 | `expression/string`          | OK       | join + escapes             | OK                                   | done   |
| 22 | `expression/member`          | OK       | DLR + nested Projection    | OK                                   | done   |
| 23 | `expression/primary`         | OK       | identity                   | OK                                   | done   |
| 24 | `expression/unary`           | OK       | identity                   | OK                                   | done   |
| 25 | `expression/expression`      | OK       | identity                   | OK                                   | done   |
| 26 | `expression/expression.lang` | pipeline | unwrap                     | OK                                   | done   |

### Phase 3 — Pattern stack

| #   | Module                 | G1            | G2                     | G3                                 | Ready? |
| --- | ---------------------- | ------------- | ---------------------- | ---------------------------------- | ------ |
| 27  | `pattern/atoms`        | OK            | object `{kind:"any"}`  | OK proj                            | done   |
| 28  | `pattern/literals`     | OK            | serializable projs     | character_class.uff + literals.uff | done   |
| 29  | `pattern/resolve`      | OK (B9 layer) | flat+coalesce          | OK                                 | done   |
| 30  | `pattern/structure`    | OK (B9 layer) | from_entries Over keys | OK                                 | done   |
| 31  | `pattern/atomic`       | OK            | identity               | OK                                 | done   |
| 32  | `pattern/prefix`       | OK            | object AST wraps       | Star arms; no throw (B8)           | done   |
| 33  | `pattern/then`         | OK            | std `one` + `*`        | OK                                 | done   |
| 34  | `pattern/pipe`         | OK            | std `one` + `*`        | OK                                 | done   |
| 34a | `pattern/projection`   | OK            | object proj / identity | `(Pipe Tail) \| Pipe` (rules-001)  | done   |
| 35  | `pattern/and`          | OK            | std `one` + `*`        | OK                                 | done   |
| 36  | `pattern/or`           | OK            | std `one` + `*`        | OK                                 | done   |
| 37  | `pattern/pattern`      | OK            | identity               | OK                                 | done   |
| 38  | `pattern/pattern.lang` | pipeline      | unwrap                 | OK                                 | done   |

### Phase 4 — Uffda language surface

| #  | Module                   | Ready?                        |
| -- | ------------------------ | ----------------------------- |
| 39 | `uffda/shared.rules`     | done                          |
| 40 | `uffda/import.rules`     | done                          |
| 41 | `uffda/export.rules`     | done                          |
| 42 | `uffda/rule.rules`       | done                          |
| 43 | `uffda/uffda.lang`       | done                          |
| 44 | `uffda/runtime.compiler` | done (Resolver.import `.uff`) |

### Phase 5 — Tokenizer / source (last; convert after B6/B7)

These are still in-scope for full `.uff` conversion. Do not leave them as
permanent TypeScript language modules once builtins exist.

| #  | Module                     | Ready?                                     |
| -- | -------------------------- | ------------------------------------------ |
| 45 | `tokenizer/mod`            | hard; joins + token-kind objects (B2)      |
| 46 | `tokenizer/structured`     | after token/mod projections                |
| 47 | `source/mod`               | **blocked** (B6) — then convert            |
| 48 | `tokenizer/tokenizer.lang` | **blocked** (B7) — then convert (**must**) |

## Per-conversion checklist (use every time)

1. Open the `.ts` module; list PatternKinds and every Native `fn`.
2. Score G0 / G1 / G2 / G3 explicitly (pass / fail + note). G0 = compiles with
   installed latest `uffda`, not in-tree CLI.
3. If any gate fails: fix in `.ts` (and std/spec if needed) **before** `.uff`;
   if G0 fails for missing CLI features, publish those features first.
4. Author `.uff`; compile via `deno task compile:lang` (or published
   `uffda compile` once that CLI includes the ModuleDeclaration pipeline).
5. Point imports / registry at `.uff`; delete the `.ts` twin; run tests +
   compile-then-import (tests load from `./bin`).
6. Update this plan’s Ready? column and CI compile list.

## First candidate (next session)

Phase 5: `tokenizer/mod`; B6/B7 still block `source` / `tokenizer.lang`. Pattern
stack leaves are converted.

Optional `recursive rule` sugar remains deferred
([#98](https://github.com/justinmchase/uffda/issues/98)).

## References

- Spec: `.agents/specifications/languages/compiler-bootstrap.spec.md`
- Spec: `.agents/specifications/modules.spec.md` (`.uff` import remapping)
- Spec: `.agents/specifications/languages/pattern-idioms-map-reduce.spec.md`
- Spec: `.agents/specifications/patterns/runtime/projection.spec.md`
- Checklist: `.agents/specifications/languages/pattern-bootstrap-checklist.md`
- Example: `src/lang/common/characters/digit.uff`
- Std: `src/runtime/std/mod.ts` (`add`, `coalesce`, `filter`, `flat`, `format`,
  `id`, `int`, `join`, `json`, `map`, `one`, `pack`)
- Follow-up: https://github.com/justinmchase/uffda/issues/98 (`recursive rule`)

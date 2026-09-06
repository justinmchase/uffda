# Uffda language module → `.uff` conversion plan

Status: living plan. Convert **one module at a time**. Before each conversion,
re-check the three gates below and record the outcome in the per-module section
(or a follow-up PR note). Conversion **replaces** the `.ts` module: dependents
import the `.uff` URL, registry entries for that module are dropped, and the
`.ts` file is deleted once `.uff` → `./bin` remapping works in tests and CI.

CLI baseline for this effort: **uffda 0.1.3** (published), with
compile-then-import and draft-tag pinning on `main`.

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

- The intended `.uff` text MUST compile with the installed latest `uffda`
  (`uffda compile … --out-dir ./bin`).
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

| Smell in Native                                                            | Prefer                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Split / scan / classify strings                                            | Character / equal / into / quantifier patterns         |
| Inspect object shape / discriminators to “parse”                           | `over {…}`, typed into, resolve rules                  |
| Conditional structure from “what matched” when patterns could discriminate | Separate alternatives with distinct projections        |
| Walk match trees / spans                                                   | Pattern pipeline that already yields structured values |

Identity `({ _ }) => _` and pure AST wrappers
`({ pattern }) => ({ kind: "not", pattern })` are projections (OK once Native is
replaced). `_.flat().join("")`, `parseInt`, match-span indexing are usually
**not** ready until G2/G3 are fixed in `.ts`.

### Additional gates

- **G4 — Imports:** Prefer `ImportDeclarationKind.Module` with `.uff` URLs once
  children are converted; eliminate `ImportDeclarationKind.Native` embeds.
- **G5 — Registry:** Keep `builtInLanguageDeclarations` keyed by the logical
  `.uff` URL via a host `*.bootstrap.ts` declaration so published CLIs can
  compile without a pre-existing `./bin`. Remapping tests omit registry entries
  to prove artifact loading.
- **G6 — Tests:** Existing `*.test.ts` must keep passing; add compile +
  `.uff`-import smoke where useful.
- **G7 — CI:** Extend Checks compile-then-import as modules land under `./bin`.

## Global blockers (shared workstreams)

These unlock many modules; schedule explicitly rather than rediscovering per
file:

| ID  | Blocker                                                      | Needed by                            | Direction                                                                               |
| --- | ------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------- |
| B1  | Replace Native with serializable projections                 | ~45 modules                          | ExpressionLang object/invocation forms + std                                            |
| B2  | List flatten + join (`_.flat().join("")`)                    | identifier, string, tokenizer, rules | std `flat`/`join` or reshape Then so `_` is already flat                                |
| B3  | Digit string → number                                        | expression/number, prefix bounds     | std `int`/`number` or pattern that yields number                                        |
| B4  | Length-1 list collapse (`patterns.length===1 ? p : wrapper`) | then/pipe/and/or                     | Always emit wrapper (behavior review) or std helper                                     |
| B5  | Quantifier optional-array unwrap                             | many                                 | Pattern/coalesce convention in `.ts` first                                              |
| B6  | Host match spans / checksum / line index                     | source/mod                           | New std/host builtins or keep hybrid                                                    |
| B7  | Match-tree semantic text walk                                | tokenizer.lang                       | Same as B6                                                                              |
| B8  | Validation `throw` in projection                             | prefix bounds                        | Fail in pattern, not expression                                                         |
| B9  | Pattern stack import cycles                                  | resolve/structure ↔ pattern          | Convert as a layer with temporary TS bridges                                            |
| B10 | Parametric rules (`Surround<L,P,R>`, `Token<P>`)             | surround, token                      | Confirm Uffda rule-parameter syntax                                                     |
| B11 | PatternLang string escapes (`\t`, `\n`, `\r`, `\\`, …)       | whitespace, newLine, many later      | Interpret escapes in pattern string literals; single-char escape followers in tokenizer |

## Phase order (dependency leaves first)

Convert in this order. **Stop before each module** for human review of G1–G3.

### Phase 0 — Character leaves (prove `.uff` + bin + import)

| # | Module                         | G1                    | G2               | G3                  | Notes                                      | Ready?                    |
| - | ------------------------------ | --------------------- | ---------------- | ------------------- | ------------------------------------------ | ------------------------- |
| 0 | `common/characters/digit`      | OK `\cNd`             | none             | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done                      |
| 1 | `common/characters/connecting` | OK `\cPc`             | none             | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done                      |
| 2 | `common/characters/formatting` | OK `\cCf`             | none             | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done                      |
| 3 | `common/characters/letter`     | OK `\cL\|\cNl`        | none             | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done                      |
| 4 | `common/characters/combining`  | OK `\cMn\|\cMe\|\cMc` | none             | none                | Replaced `.ts`; loads via `.uff` → `./bin` | done                      |
| 5 | `common/characters/whitespace` | OK                    | Native identity  | OK (no parse)       | Needs Equal `"\t"` (B11) then publish      | **blocked** (B11 publish) |
| 6 | `common/characters/newLine`    | OK                    | Native `-> "\n"` | OK project constant | Needs Equal `"\r"`/`"\n"` + project (B11)  | **blocked** (B11 publish) |
| 7 | `common/characters/mod`        | n/a                   | n/a              | n/a                 | Re-exports; needs children                 | after 1–6                 |

### Phase 1 — Common helpers

| #  | Module              | G1             | G2                   | G3                                         | Ready?                     |
| -- | ------------------- | -------------- | -------------------- | ------------------------------------------ | -------------------------- |
| 8  | `common/identifier` | OK             | **B2** `flat().join` | Projection of chars (OK) if flatten is std | **no** until B2            |
| 9  | `common/surround`   | params **B10** | Native `-> p`        | OK                                         | **no** until B10 confirmed |
| 10 | `tokenizer/token`   | needs surround | none special         | OK                                         | after 9                    |
| 11 | `common/spread`     | needs token    | none                 | OK                                         | after 10                   |

### Phase 2 — Expression stack (bottom-up)

| #  | Module                       | G1       | G2                   | G3                                                      | Ready?                           |
| -- | ---------------------------- | -------- | -------------------- | ------------------------------------------------------- | -------------------------------- |
| 12 | `expression/number`          | OK       | **B3** parseInt+join | Digits matched by pattern; Native parses — fix with std | **no** until B3                  |
| 13 | `expression/boolean`         | OK       | object proj          | OK                                                      | nearly — replace Native wrappers |
| 14 | `expression/nullish`         | OK       | Value proj           | OK                                                      | nearly                           |
| 15 | `expression/reference`       | OK       | Reference wrap       | OK                                                      | nearly                           |
| 16 | `expression/terminal`        | OK       | identity             | OK                                                      | nearly                           |
| 17 | `expression/not`             | OK       | Not wrap             | OK                                                      | nearly                           |
| 18 | `expression/array`           | OK       | Array AST proj       | OK                                                      | nearly                           |
| 19 | `expression/object`          | OK       | Object AST proj      | OK                                                      | nearly                           |
| 20 | `expression/sequence`        | OK       | Invocation AST       | OK                                                      | nearly                           |
| 21 | `expression/string`          | OK       | **B2** join content  | Content via patterns; join is proj                      | **no** until B2                  |
| 22 | `expression/member`          | OK       | left-fold segments   | Fold is proj (OK) if expressible                        | medium — needs fold/`pack` story |
| 23 | `expression/primary`         | OK       | identity             | OK                                                      | after children                   |
| 24 | `expression/unary`           | OK       | identity             | OK                                                      | after children                   |
| 25 | `expression/expression`      | OK       | identity             | OK                                                      | after children                   |
| 26 | `expression/expression.lang` | pipeline | unwrap               | OK                                                      | after expression                 |

### Phase 3 — Pattern stack

| #  | Module                 | G1                                    | G2                            | G3                                          | Ready?                          |
| -- | ---------------------- | ------------------------------------- | ----------------------------- | ------------------------------------------- | ------------------------------- |
| 27 | `pattern/atoms`        | OK                                    | object `{kind:"any"}`         | OK proj                                     | nearly                          |
| 28 | `pattern/literals`     | heavy CharacterClass/includes/between | many Natives                  | mostly AST wrap; audit string/number unwrap | hard; after expr number/boolean |
| 29 | `pattern/resolve`      | **B9** cycle                          | optional-arg unpack           | OK                                          | hard                            |
| 30 | `pattern/structure`    | **B9** cycle                          | Over AST                      | OK                                          | hard                            |
| 31 | `pattern/atomic`       | OK                                    | identity                      | OK                                          | after 27–30                     |
| 32 | `pattern/prefix`       | OK                                    | **B8** throw/validate; **B5** | Bounds validation must move to patterns     | **blocked** until B8            |
| 33 | `pattern/then`         | OK                                    | **B4**                        | OK                                          | after B4                        |
| 34 | `pattern/pipe`         | OK                                    | **B4**                        | OK                                          | after B4                        |
| 35 | `pattern/and`          | OK                                    | **B4**                        | OK                                          | after B4                        |
| 36 | `pattern/or`           | OK                                    | **B4**                        | OK                                          | after B4                        |
| 37 | `pattern/pattern`      | OK                                    | identity                      | OK                                          | after or                        |
| 38 | `pattern/pattern.lang` | pipeline                              | unwrap                        | OK                                          | after pattern                   |

### Phase 4 — Uffda language surface

| #  | Module                   | Ready?                                              |
| -- | ------------------------ | --------------------------------------------------- |
| 39 | `uffda/shared.rules`     | after identifier                                    |
| 40 | `uffda/import.rules`     | after B2 (path join) + shared                       |
| 41 | `uffda/export.rules`     | after shared/rules                                  |
| 42 | `uffda/rule.rules`       | after pattern.lang + expression.lang + B2           |
| 43 | `uffda/uffda.lang`       | after import/export/rule                            |
| 44 | `uffda/runtime.compiler` | after syntax objects stable; list-merge projections |

### Phase 5 — Host pipelines (last / hybrid allowed)

| #  | Module                     | Ready?                           |
| -- | -------------------------- | -------------------------------- |
| 45 | `tokenizer/mod`            | hard; joins + token-kind objects |
| 46 | `source/mod`               | **blocked** (B6)                 |
| 47 | `tokenizer/tokenizer.lang` | **blocked** (B7)                 |

## Per-conversion checklist (use every time)

1. Open the `.ts` module; list PatternKinds and every Native `fn`.
2. Score G0 / G1 / G2 / G3 explicitly (pass / fail + note). G0 = compiles with
   installed latest `uffda`, not in-tree CLI.
3. If any gate fails: fix in `.ts` (and std/spec if needed) **before** `.uff`;
   if G0 fails for missing CLI features, publish those features first.
4. Author `.uff`; compile with installed `uffda compile … --out-dir ./bin`.
5. Point imports / registry at `.uff`; delete the `.ts` twin; run tests +
   compile-then-import (tests load from `./bin`).
6. Update this plan’s Ready? column and CI compile list.

## First candidate (next session)

**Publish B11, then convert `whitespace`.**

In-tree PatternLang now interprets `\t` `\n` `\r` `\\` `\"` in string literals
(tokenizer emits single-char semantic escape followers). Whitespace conversion
still waits until that surface ships in a published CLI (G0).

Completed: `digit`, `connecting`, `formatting`, `letter`, `combining`.

## References

- Spec: `.agents/specifications/languages/compiler-bootstrap.spec.md`
- Spec: `.agents/specifications/modules.spec.md` (`.uff` import remapping)
- Checklist: `.agents/specifications/languages/pattern-bootstrap-checklist.md`
- Example: `src/lang/common/characters/digit.uff`
- Std: `src/runtime/std/mod.ts` (`add`, `coalesce`, `filter`, `format`, `id`,
  `join`, `json`, `map`, `pack`)

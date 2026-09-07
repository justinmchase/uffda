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
- **G5 — Artifacts only:** Converted `.uff` modules MUST NOT retain TypeScript
  twins or `*.bootstrap.ts` host stubs in the in-tree registry. The published
  CLI (N) embeds `./bin` AST JSON via `deno compile --include` and remaps
  logical `.uff` URLs from the binary extract root; in-tree runtime loads from
  workspace `./bin` after `compile:lang`.
- **G6 — Tests:** Existing `*.test.ts` must keep passing; add compile +
  `.uff`-import smoke where useful.
- **G7 — CI:** Extend Checks compile-then-import as modules land under `./bin`.

## Global blockers (shared workstreams)

These unlock many modules; schedule explicitly rather than rediscovering per
file:

| ID  | Blocker                                                      | Needed by                                   | Direction                                                   |
| --- | ------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| B1  | Replace Native with serializable projections                 | ~45 modules                                 | ExpressionLang object/invocation forms + std                |
| B2  | List flatten + join (`_.flat().join("")`)                    | identifier (done), string, tokenizer, rules | std `flat`/`join` — `flat`/`join` added; string still B15   |
| B3  | Digit string → number                                        | expression/number (done)                    | std `int` shipped with number.uff                           |
| B4  | Length-1 list collapse (`patterns.length===1 ? p : wrapper`) | then/pipe/and/or                            | Always emit wrapper (behavior review) or std helper         |
| B5  | Quantifier optional-array unwrap                             | many                                        | `(flat (coalesce k []))` / star rewrite; more sugar later   |
| B6  | Host match spans / checksum / line index                     | source/mod, tokenizer                       | New std/host builtins — then convert (not permanent hybrid) |
| B7  | Match-tree semantic text walk                                | tokenizer.lang                              | Same as B6 — required before tokenizer.lang `.uff`          |
| B8  | Validation `throw` in projection                             | prefix bounds                               | Fail in pattern, not expression                             |
| B9  | Pattern stack import cycles                                  | resolve/structure ↔ pattern                 | Convert as a layer with temporary TS bridges                |
| B10 | Parametric rules (`Surround<L,P,R>`, `Token<P>`)             | surround, token                             | Declaration syntax shipped in 0.1.11                        |
| B11 | PatternLang + ExpressionLang string escapes (`\t`, `\n`, …)  | whitespace, newLine (done)                  | Shipped; expression escapes enable `-> "\n"`                |
| B12 | Multi-letter variable bindings in PatternLang                | readable `.uff` (esp. `*.lang`)             | Published CLI today accepts only single-letter `name:P`     |
| B13 | Expression string proj of `"{"` / `"}"`                      | object braces, similar tokens               | `-> "{"` parses as object literal; use bare Equal or `-> _` |
| B14 | Left-fold over lists without domain helpers                  | expression/member, similar AST folds        | std `reduce` + ExpressionLang lambda literals (not `for`)   |
| B15 | `"\\"` pattern + object/string projection in one module      | expression/string                           | Published CLI parse fails when both appear; split or fix    |

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

| #  | Module                       | G1       | G2                            | G3                                   | Ready?                         |
| -- | ---------------------------- | -------- | ----------------------------- | ------------------------------------ | ------------------------------ |
| 12 | `expression/number`          | OK       | `(int (join (flat _) ""))`    | Digits matched by pattern; `int` std | done                           |
| 13 | `expression/boolean`         | OK       | object proj                   | OK                                   | done                           |
| 14 | `expression/nullish`         | OK       | Value proj                    | OK                                   | done                           |
| 15 | `expression/reference`       | OK       | Reference wrap                | OK                                   | done                           |
| 16 | `expression/terminal`        | OK       | identity                      | OK                                   | done                           |
| 17 | `expression/not`             | OK       | Not wrap                      | OK                                   | done                           |
| 18 | `expression/array`           | OK       | Array AST proj                | OK                                   | done                           |
| 19 | `expression/object`          | OK       | Object AST proj               | OK (`flat` unwrap)                   | done                           |
| 20 | `expression/sequence`        | OK       | Invocation AST                | OK                                   | done                           |
| 21 | `expression/string`          | OK       | join + escapes                | OK                                   | **no** until B15               |
| 22 | `expression/member`          | OK       | left-fold via `reduce`+lambda | OK                                   | **no** until lambda + `reduce` |
| 23 | `expression/primary`         | OK       | identity                      | OK                                   | done                           |
| 24 | `expression/unary`           | OK       | identity                      | OK                                   | done                           |
| 25 | `expression/expression`      | OK       | identity                      | OK                                   | done                           |
| 26 | `expression/expression.lang` | pipeline | unwrap                        | OK                                   | done                           |

### Phase 3 — Pattern stack

| #  | Module                 | G1                                    | G2                            | G3                                          | Ready?                           |
| -- | ---------------------- | ------------------------------------- | ----------------------------- | ------------------------------------------- | -------------------------------- |
| 27 | `pattern/atoms`        | OK                                    | object `{kind:"any"}`         | OK proj                                     | done                             |
| 28 | `pattern/literals`     | heavy CharacterClass/includes/between | many Natives                  | mostly AST wrap; audit string/number unwrap | hard; after expr number/boolean  |
| 29 | `pattern/resolve`      | **B9** cycle                          | optional-arg unpack           | OK                                          | hard                             |
| 30 | `pattern/structure`    | **B9** cycle                          | Over AST                      | OK                                          | hard                             |
| 31 | `pattern/atomic`       | OK                                    | identity                      | OK                                          | done                             |
| 32 | `pattern/prefix`       | OK                                    | **B8** throw/validate; **B5** | Bounds validation must move to patterns     | **blocked** until B8             |
| 33 | `pattern/then`         | OK                                    | **B4**                        | OK                                          | after B4                         |
| 34 | `pattern/pipe`         | OK                                    | **B4**                        | OK                                          | after B4                         |
| 35 | `pattern/and`          | OK                                    | **B4**                        | OK                                          | after B4                         |
| 36 | `pattern/or`           | OK                                    | **B4**                        | OK                                          | after B4                         |
| 37 | `pattern/pattern`      | OK                                    | identity                      | OK                                          | after or                         |
| 38 | `pattern/pattern.lang` | pipeline                              | unwrap                        | OK                                          | after pattern — **must** convert |

### Phase 4 — Uffda language surface

| #  | Module                   | Ready?                                              |
| -- | ------------------------ | --------------------------------------------------- |
| 39 | `uffda/shared.rules`     | done                                                |
| 40 | `uffda/import.rules`     | after B2 (path join) + shared                       |
| 41 | `uffda/export.rules`     | after shared/rules                                  |
| 42 | `uffda/rule.rules`       | after pattern.lang + expression.lang + B2           |
| 43 | `uffda/uffda.lang`       | after import/export/rule                            |
| 44 | `uffda/runtime.compiler` | after syntax objects stable; list-merge projections |

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
4. Author `.uff`; compile with installed `uffda compile … --out-dir ./bin`.
5. Point imports / registry at `.uff`; delete the `.ts` twin; run tests +
   compile-then-import (tests load from `./bin`).
6. Update this plan’s Ready? column and CI compile list.

## First candidate (next session)

Pause module conversion. Next: design ExpressionLang **lambda** syntax and add
std **`reduce`** (functional map/reduce only — no `for`/`foreach`). Then convert
`expression/member`. `expression/string` still blocked on B15.

Number and shared.rules are converted; member stays TypeScript until then.

## References

- Spec: `.agents/specifications/languages/compiler-bootstrap.spec.md`
- Spec: `.agents/specifications/modules.spec.md` (`.uff` import remapping)
- Checklist: `.agents/specifications/languages/pattern-bootstrap-checklist.md`
- Example: `src/lang/common/characters/digit.uff`
- Std: `src/runtime/std/mod.ts` (`add`, `coalesce`, `filter`, `flat`, `format`,
  `id`, `int`, `join`, `json`, `map`, `pack`)

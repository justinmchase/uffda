---
id: cli-bootstrap-036
title: Prefix module has authored .uff source (B8)
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/pattern-syntax/grammar.spec.md#binding-and-repetition; .agents/specifications/patterns/runtime/quantifier.spec.md"
---

# Prefix Uff Source (B8)

## Requirement

Preconditions:

- `pattern/atomic`, `pattern/pattern`, `common/identifier`, and
  `expression/number` are converted.
- Quantifier runtime rejects invalid `min`/`max` at match time.

Expected behavior:

- `src/lang/pattern/prefix.uff` MUST export `Prefix`.
- Postfix `*` forms MUST be distinct arms (`StarMinMax`, `StarMinOpen`,
  `StarMaxOnly`, `StarMinOnly`, `StarBare`) rather than optional-bounds unwrap
  plus Native `throw`.
- Bound numerals MUST come from `Number` digit strings projected as
  `value.literal` (`BoundLiteral` / `NonNegNum`). Contextual `$name` bounds MUST
  project `value.variable` (`BoundVariable`). Star arms MUST accept either via
  `Bound`, except digit–digit `StarMinMax` which MUST use
  `m:(BoundNum |> (number & $n..))` so descending bounds fail at parse.
- Shorter star arms MUST use negative lookahead so they do not succeed on a
  proper prefix of a longer form (e.g. `StarMinOpen` MUST reject a following
  `Bound`, `StarMinOnly` MUST reject following `..`, `StarBare` MUST reject a
  following `Bound` or `.`). Otherwise descending `*2..1` would parse as `*2..`
  with a leftover token.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Dependents (`then.uff`) import `./prefix.uff`; the TypeScript twin is gone.
- Conversion-plan blocker B8 is closed for prefix.
- Descending digit bounds such as `*2..1` MUST fail to parse. Variable or mixed
  bounds MAY still parse; Quantifier runtime remains authoritative for those.

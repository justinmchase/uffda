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
  `value.literal` (`BoundLiteral`). Contextual `$name` bounds MUST project
  `value.variable` (`BoundVariable`). Star arms MUST accept either via `Bound`.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Dependents (`then.uff`) import `./prefix.uff`; the TypeScript twin is gone.
- Conversion-plan blocker B8 is closed for prefix.
- Descending bounds such as `*2..1` MAY parse to a Quantifier AST; evaluation of
  that quantifier MUST still reject at runtime.

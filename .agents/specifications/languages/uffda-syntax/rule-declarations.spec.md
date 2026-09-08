# Rule declaration syntax

This chapter defines Uffda rule declaration forms.

## Logical purpose

Rule declarations bind rule names and parameters to a pattern body and an
optional projection expression.

## Core rule contracts

- Rule declarations MUST include a stable rule identity (name).
- Rule declarations MUST begin with one of the supported declaration headers:
  - `rule`
  - `export rule`
- Rule declarations MUST place `=` between the rule identity (and any parameter
  list) and the pattern body.
- Rule declarations MAY include ordered parameter lists.
- When a parameter list is present, it MUST use angle-bracket form
  `Name<P1, P2, …>` immediately after the rule name, with comma-separated
  parameter identifiers (trailing commas MAY be accepted).
- Parameter names MUST be identifiers; they bind as rule-local resolve targets
  for the pattern body and projection (same runtime model as
  `RuleDeclaration.parameters`).
- Call sites MUST use PatternLang resolve arguments (`Rule<Arg1, Arg2, …>`),
  which already exist independently of declaration syntax.
- Rule declarations MUST include a pattern body slot parsed through
  `PatternLang`.
- Rule declarations MAY include a trailing whole-body projection expression slot
  parsed through `ExpressionLang` (`rule Name = P -> E;`).
- Whole-body rule projection MUST remain group-less: authors MUST NOT be
  required to wrap the entire pattern body in `(…)` solely to attach a
  rule-level projection.
- Whole-body rule projection SHOULD normalize so its observable result matches
  wrapping the pattern body in a
  [projection](../../patterns/runtime/projection.spec.md) pattern (desugar to
  Projection or equivalent), including when the body is directly left-recursive.
- Nested projection forms inside the PatternLang body (`P -> E`) MUST coexist
  with an optional trailing rule-level projection slot.
- Rule declaration syntax MUST conform to the module declaration keyword model
  where `rule` and `export rule` select rule-declaration body parsing.
- An exported rule declaration MUST normalize to the same ordered syntax
  declarations as a standalone export immediately followed by the equivalent
  rule declaration.
- The canonical syntax tree MUST preserve the ordered parameter list on each
  rule declaration so runtime compilation can emit `RuleDeclaration.parameters`.

## Integration contracts

- Pattern slots in rule declarations MUST delegate parsing to `PatternLang`
  rather than duplicating pattern grammar in the Uffda layer.
- Projection slots in rule declarations MUST delegate parsing to
  `ExpressionLang` rather than duplicating expression grammar in the Uffda
  layer.
- Nested pattern-body projections are PatternLang projection forms; trailing
  rule-level projections are declaration-layer slots that SHOULD desugar to the
  same runtime projection mechanism.
- The canonical syntax tree MUST preserve pattern/projection slot boundaries so
  downstream compilers can distinguish matcher logic from projection logic.

## Failure surface

- Missing required rule components MUST fail deterministically.
- Rule declaration syntax SHOULD provide diagnostics scoped to declaration
  headers, pattern slots, and projection slots.

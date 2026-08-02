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
- Rule declarations MUST include a pattern body slot parsed through
  `PatternLang`.
- Rule declarations MAY include a projection expression slot parsed through
  `ExpressionLang`.
- Rule declaration syntax MUST conform to the module declaration keyword model
  where `rule` and `export rule` select rule-declaration body parsing.
- An exported rule declaration MUST normalize to the same ordered syntax
  declarations as a standalone export immediately followed by the equivalent
  rule declaration.

## Integration contracts

- Pattern slots in rule declarations MUST delegate parsing to `PatternLang`
  rather than duplicating pattern grammar in the Uffda layer.
- Projection slots in rule declarations MUST delegate parsing to
  `ExpressionLang` rather than duplicating expression grammar in the Uffda
  layer.
- The canonical syntax tree MUST preserve pattern/projection slot boundaries so
  downstream compilers can distinguish matcher logic from projection logic.

## Failure surface

- Missing required rule components MUST fail deterministically.
- Rule declaration syntax SHOULD provide diagnostics scoped to declaration
  headers, pattern slots, and projection slots.

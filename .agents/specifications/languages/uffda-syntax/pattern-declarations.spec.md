# Rule declaration keyword syntax

This chapter defines rule declaration keyword contracts for Uffda modules.

## Logical purpose

Rule declarations define named rule entries that bind one declared pattern
body with an optional projection expression.

## Core contracts

- A rule declaration MUST define exactly one pattern body slot.
- A rule declaration MAY include a projection clause.
- Rule declarations without a projection clause MUST remain valid.
- Rule declarations MUST use the `rule` declaration keyword.

## Integration contracts

- Pattern body slots MUST delegate parsing to `PatternLang`.
- Projection clauses, when present, MUST delegate parsing to `ExpressionLang`.

## Canonical starter forms

- Without projection: `rule RuleName any;`
- With projection: `rule RuleName any -> 1;`

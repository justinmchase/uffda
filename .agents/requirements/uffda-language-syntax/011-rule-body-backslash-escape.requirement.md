---
id: uffda-language-syntax-011
title: Rule-body quote scanner treats backslash as escapable
spec_ref: ".agents/specifications/languages/uff-module-conversion-plan.md; .agents/specifications/languages/pattern-syntax/string-literals.spec.md"
---

# Rule Body Backslash Escape In Quoted Spans

## Requirement

Preconditions:

- Uffda rule parsing extracts pattern/projection token spans with a quote
  scanner before PatternLang / ExpressionLang run.
- PatternLang and ExpressionLang already interpret `"\\"` as a single backslash
  character.

Expected behavior:

- The rule-body quote scanner MUST treat `\\` as an escaped backslash inside
  quoted spans (alongside `\"` and `\{`).
- A module with multiple rules MUST parse successfully when one rule contains
  the pattern or projection string literal `"\\"`, including when a later rule
  also contains quotes or an object projection.
- `"\\"` MUST NOT leave the quoted span open such that a later `"` is consumed
  as content (conversion blocker B15).

Postconditions:

- Multi-rule authored `.uff` modules can include `"\\"` patterns and projections
  (required for converting `expression/string`).
- Single-rule `"\\"` behavior remains unchanged.

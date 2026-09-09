---
id: rules-001
title: Rule memoization stores post-expression success values
spec_ref: ".agents/specifications/runtime/rules.spec.md#memoization; .agents/specifications/runtime/rules.spec.md#core-contracts"
---

# Rule Memoization Stores Post-Expression Values

## Requirement

Preconditions:

- A rule `R` has a pattern that can succeed and a rule-level projection
  expression that transforms the pattern match value.
- An ordered choice retries `R` at the same input position after an earlier arm
  successfully matched `R` and then failed on a following suffix (shape
  `(R Suffix) | R`).

Expected behavior:

- The first successful evaluation of `R` MUST apply the rule-level projection
  before publishing a memoized success.
- The second evaluation of `R` at that same position MUST return the projected
  success value (not the raw pre-expression pattern match).
- `(R Suffix) | R` with projected `R` MUST therefore succeed on the second arm
  with the projected value when `Suffix` fails.

Postconditions:

- Optional-suffix authoring such as PatternLang
  `Projection = (Pipe Tail) | Pipe` remains correct without rewriting to
  Maybe/`when` solely to avoid memo reuse.
- Existing DLR growth behavior that relies on nested Projection during growth
  remains unchanged.

---
id: uffda-language-syntax-010
title: Rule-level projection remains group-less and coexists with nested Projection
spec_ref: ".agents/specifications/languages/uffda-syntax/rule-declarations.spec.md#core-rule-contracts; .agents/specifications/patterns/runtime/projection.spec.md"
---

# Rule-Level Projection Compatibility

## Requirement

Preconditions:

- Nested `P -> E` projection patterns exist in PatternLang.
- Rule declarations may still include a trailing whole-body `-> E` slot.

Expected behavior:

- `rule Name = P -> E;` MUST remain valid without requiring authors to wrap the
  entire pattern body in `(…)`.
- Nested projections inside the pattern body MUST NOT prevent a trailing
  rule-level `->` from being recognized when present as the rule's whole-body
  projection slot.
- `rule M = (any -> 1) | fail;` MUST parse with a nested Projection on the first
  Or arm and no rule-level projection.
- Simple rules that only need one projection for every success path MUST NOT be
  forced to use mid-pattern groups.

Postconditions:

- Group-less rule authoring is preserved while Member-style per-arm projections
  use nested `P -> E | Q` or `(P -> E) | Q`.

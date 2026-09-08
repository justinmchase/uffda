---
id: pattern-language-syntax-006
title: PatternLang accepts nested projection arrow with ExpressionLang slots
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#projection-forms; .agents/specifications/patterns/runtime/projection.spec.md"
---

# Nested Projection Syntax

## Requirement

Preconditions:

- PatternLang parses a pattern body that may include ExpressionLang slots at
  projection forms.
- Projection syntax uses `P -> E` where E is parsed by ExpressionLang.

Expected behavior:

- `P -> E` MUST normalize to a projection pattern whose child is P and whose
  expression is E.
- Projection MUST bind more tightly than alternation and conjunction, so
  `P -> E | Q` MUST normalize to Or(Projection(P, E), Q). Authors MAY write
  `(P -> E) | Q` for clarity.
- Ordered sequence MUST bind more tightly than projection, so `A B -> E` MUST
  mean Projection of the sequence `(A B)`.
- Grouping `(P -> E)` MUST be accepted.

Postconditions:

- Authors can express Member-style `(recursiveArm -> ast) | base` in PatternLang
  once the published CLI includes this syntax.

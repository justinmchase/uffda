---
id: pattern-language-syntax-005
title: Compact capture and postfix repetition normalize to canonical patterns
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#binding-and-repetition"
---

# Compact Capture And Postfix Repetition

## Requirement

Preconditions:

- Pattern syntax receives tokenized source containing capture or postfix
  repetition forms.

Expected behavior:

- `x:P` MUST normalize to a variable pattern named `x` whose child is `P`.
- `{ field: x:P }` MUST normalize to a keyed `field` pattern containing that
  variable pattern.
- `P*`, `P*min`, `P*min..max`, and `P*..max` MUST normalize to quantifier
  patterns with the corresponding inclusive bounds.
- `P+` MUST normalize to a quantifier with minimum one.
- `P?` MUST normalize to a maybe pattern rather than a quantifier.
- Invalid or chained repetition suffixes MUST not produce a successful complete
  pattern parse.

Postconditions:

- Compact forms produce only existing canonical runtime pattern variants.

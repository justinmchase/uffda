---
id: uffda-language-syntax-007
title: Rule declarations require an equals separator
spec_ref: ".agents/specifications/languages/uffda-syntax/rule-declarations.spec.md#core-rule-contracts"
---

# Rule Definition Separator

## Requirement

Preconditions:

- A Uffda module contains a rule declaration.

Expected behavior:

- The declaration MUST contain `=` between the rule name and pattern body.
- The declaration MUST support an optional `->` projection after its pattern.
- The corresponding bare declaration without `=` MUST fail.

Postconditions:

- The syntax tree contains the same structured rule declaration shape used by
  runtime compilation; `=` does not appear in the output model.

---
id: uffda-language-syntax-009
title: Rule declarations may declare ordered parameter lists
spec_ref: ".agents/specifications/languages/uffda-syntax/rule-declarations.spec.md#core-rule-contracts"
---

# Rule Parameter Lists

## Requirement

Preconditions:

- A Uffda module contains a rule declaration.
- PatternLang already accepts resolve call-site arguments (`Name<…>`).

Expected behavior:

- A rule declaration MAY include an ordered parameter list after the rule name
  using angle brackets: `rule Name<P1, P2> = …;`.
- Parameter names MUST be identifiers separated by commas.
- The syntax AST for the rule MUST include `parameters` as an ordered list of
  `{ name }` objects (empty when omitted).
- Runtime compilation MUST copy those parameters onto
  `RuleDeclaration.parameters`.
- A parametric rule MUST be invokable from PatternLang via `Name<Arg1, Arg2, …>`
  and execute with parameter bindings.

Postconditions:

- Modules such as `common/surround` can be authored in `.uff` once this syntax
  ships in a published CLI.

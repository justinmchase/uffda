---
id: rule-decorators-002
title: Attribute lists parse as stacked bracket groups preceding rule/func declarations and resolve exclusively against decorator declarations
spec_ref: ".agents/specifications/languages/uffda-syntax/declaration-attributes.spec.md#rough-grammar; .agents/specifications/languages/uffda-syntax/declaration-attributes.spec.md#core-contracts"
---

# Attribute Syntax and Stacking

## Requirement

Preconditions:

- A module source document is parsed by the Uffda syntax parser.

Expected behavior:

- A bare attribute (`[Name]`) MUST parse as an invocation of decorator `Name`
  with zero arguments.
- An attribute with arguments (`[Name arg1 arg2]`) MUST parse each argument as a
  space-separated `ExpressionLang` expression, using the same argument grammar
  as ordinary invocation (`(Name arg1 arg2)`) minus the wrapping parens.
- Multiple attributes on one declaration MUST parse as separate stacked bracket
  groups (`[Foo][Bar]`, `[Foo 0][Bar 1]`) and MUST NOT parse a comma-separated
  list inside a single bracket pair as multiple attributes.
- An attribute list immediately preceding `rule`, `export rule`, `func`, or
  `export func` MUST attach to that declaration.
- An attribute list preceding any other top-level declaration keyword (including
  `decorator`) MUST fail to parse.
- `Name` MUST resolve exclusively against `decorator` declarations
  (`Module.decorators`/`Module.decoratorImports`); it MUST NOT resolve against
  `rule`, `func`, or ordinary imported names.
- The parsed declaration's attribute order MUST match the written left-to-right
  (or top-to-bottom, one per line) order of the bracket groups.

Postconditions:

- The canonical syntax tree for a decorated declaration carries an ordered list
  of `{ name, args }` attribute entries preserving written order, without
  introducing a new top-level declaration family.

---
id: rule-decorators-001
title: Decorator declarations parse with their own keyword, parallel to func, and cannot themselves carry an attribute list
spec_ref: ".agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md#rough-grammar; .agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md#core-contracts"
---

# Decorator Declaration Syntax

## Requirement

Preconditions:

- A module source document is parsed by the Uffda syntax parser.

Expected behavior:

- `decorator Name = Expression;` MUST parse as a top-level declaration
  structurally identical to a `func` declaration (optional `<…>` parameter list,
  `=`, expression body, terminating `;`), differing only in its `decorator`
  keyword.
- `decorator` declarations MUST be exportable inline
  (`export decorator Name =
  …;`) and via a later bare `export Name;`, the same
  way `rule`/`func` declarations are.
- A `decorator` declaration MUST NOT be preceded by an attribute list
  (`[Foo] decorator Bar = …;` MUST fail to parse).
- A `decorator` declaration's name MUST occupy its own namespace: it MUST NOT
  collide with any `rule`, `func`, or imported name in the same module, and vice
  versa.

Postconditions:

- The canonical syntax tree contains a distinct declaration kind for `decorator`
  declarations, separate from `rule`/`func` declarations, carrying
  `{ name, pattern, expression }`.

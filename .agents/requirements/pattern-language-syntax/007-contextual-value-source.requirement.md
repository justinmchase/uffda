---
id: pattern-language-syntax-007
title: Contextual $name value sources in value-operand positions
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md"
---

# Contextual `$name` value sources

## Requirement

Preconditions:

- PatternLang parses equal, between, and includes forms that take value
  operands.

Expected behavior:

- `$name` MUST parse as `"$"` + Identifier and project
  `{ kind: "value.variable", name }`.
- Bare literals and identifier equals MUST project
  `{ kind: "value.literal", value }` (never a bare serializable operand).
- Bare `$name` MUST normalize to an `equal` pattern whose value operand is that
  `value.variable` source (match input equal to the bound value).
- `$name` MUST be accepted as between bounds and includes list elements.
- `$name` MUST NOT mean pattern resolve / “run the value as a pattern.” Bare
  identifiers in pattern position remain resolve; `$` marks value binding.
- Capture of an equal-to-variable form (`x:$w`) MAY parse as capture of an equal
  pattern; that is matching a value, not resolving a rule from a binding.

Postconditions:

- Value-source syntax projects only tagged ValueSource nodes.

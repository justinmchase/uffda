---
id: expression-syntax-001
title: Expression string literals interpret common escapes
spec_ref: ".agents/specifications/languages/expression-syntax/string-and-interpolation.spec.md#syntax-requirements"
---

# Expression String Literal Escapes

## Requirement

Preconditions:

- ExpressionLang parses quoted strings used in projections and expression
  values.
- PatternLang already interprets `\t`, `\n`, `\r`, `\\`, and `\"` in pattern
  Equal literals.

Expected behavior:

- Expression string content MUST interpret `\t`, `\n`, `\r`, `\\`, and `\"` as
  the corresponding characters (in addition to existing `\{` and `\"`).
- A rule projection such as `-> "\n"` MUST compile to a string expression whose
  value is U+000A, not the two characters `\` and `n`.

Postconditions:

- Modules such as NewLine can author serializable projections without Native
  functions.

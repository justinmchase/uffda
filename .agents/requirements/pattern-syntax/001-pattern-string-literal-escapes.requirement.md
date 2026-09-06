---
id: pattern-syntax-001
title: Pattern string literals interpret common escapes
spec_ref: ".agents/specifications/languages/pattern-syntax/string-literals.spec.md#escape-sequences"
---

# Pattern String Literal Escapes

## Requirement

Preconditions:

- PatternLang parses bare string literals into Equal patterns.
- The default stack tokenizes with no-whitespace semantic texts.

Expected behavior:

- `"\t"`, `"\n"`, `"\r"`, `"\\"`, and `"\""` MUST produce Equal values whose
  strings contain the corresponding single characters (tab, LF, CR, backslash,
  quote).
- `"\tab"` MUST produce Equal value tab followed by `ab`.

Postconditions:

- Character-leaf modules such as Whitespace and NewLine can author Equal
  literals for control characters without Native projections.

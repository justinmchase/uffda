---
id: uffda-language-syntax-014
title: Formatting writes canonical text that round-trips and is idempotent
spec_ref: ".agents/specifications/languages/uffda-syntax/formatting.spec.md"
---

# Canonical Formatting

## Requirement

Preconditions:

- A Uffda source parses cleanly with UffdaLang.

Expected behavior:

- Formatting it MUST produce text that parses cleanly to a syntax tree equal to
  the source's, apart from source spans.
- Formatting that text again MUST reproduce it exactly.
- Both MUST hold for every `.uff` file in this repository.
- A declaration that fits in 80 columns MUST be written on one line; one that
  does not MUST be broken with each child on its own line, brackets opening at
  the end of a line and closing on their own line.
- Imports MUST be grouped on consecutive lines, as MUST standalone exports, with
  one empty line around every other declaration; a comment block MUST sit
  directly above the declaration after it.
- An export immediately followed by the declaration it names MUST be written
  inline.
- A source that does not parse cleanly MUST be returned as its parse, not
  formatted.

Postconditions:

- The formatted text depends only on the syntax tree.

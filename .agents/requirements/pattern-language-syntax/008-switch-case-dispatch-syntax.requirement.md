---
id: pattern-language-syntax-008
title: Switch case dispatch syntax normalizes to the switch runtime pattern
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#switch-case-dispatch"
---

# Switch Case Dispatch Syntax

## Requirement

Preconditions:

- A pattern body contains `switch { ... }`.

Expected behavior:

- Each `key: P` entry MUST normalize to one `SwitchCase` with `key` parsed as
  either `{ kind: "values", values: [...] }` (comma-separated value sources) or
  `{ kind: "characterClass", characterClass }` (a single character class), and
  `pattern: P`.
- A `default: P` entry, if present, MUST be the last entry and MUST normalize to
  the `switch` pattern's `default` field.
- `switch` and `default` MUST be reserved keywords and MUST NOT parse as bare
  rule-reference identifiers.
- Declared case order MUST be preserved in the normalized `cases` array.
- A single trailing `,` before the closing `}` MUST parse successfully.
- An empty `switch {}` body MUST normalize to
  `{ cases: [], default: undefined }`.

Postconditions:

- The normalized form MUST be a valid `switch` pattern per
  [switch](../../specifications/patterns/runtime/switch.spec.md).

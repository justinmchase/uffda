---
id: pattern-language-syntax-011
title: Object patterns parse a terminal rest-entry matcher
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#object-patterns"
---

# Object Rest-Entry Pattern Syntax

## Requirement

Preconditions:

- A pattern declaration contains an object pattern.

Expected behavior:

- The syntax `{ id: number, ...(string : string) }` MUST parse as an `over`
  pattern with named key `id` and separate string key/value rest patterns.
- A rest-entry matcher MAY appear without named entries.
- A rest-entry matcher MAY have a trailing comma.
- A compound key pattern or key capture MUST be grouped within the left side of
  the rest-entry matcher.
- A rest-entry matcher MUST be the final entry in an object pattern.

Postconditions:

- The normalized `over` pattern MUST preserve its named keys and rest child
  patterns separately.
- Tests: `src/lang/pattern/structure.test.ts`.

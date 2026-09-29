---
id: pattern-language-syntax-009
title: Skip syntax normalizes to the skip runtime pattern
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#skip"
---

# Skip Syntax

## Requirement

Preconditions:

- A pattern body contains `skip`.

Expected behavior:

- `skip P` MUST normalize to `{ kind: "skip", pattern: P }`, with `P` parsed as
  a prefix operand (`skip P*` skips the repetition; `skip v:P` skips the
  capture).
- A bare `skip` MUST normalize to `{ kind: "skip", pattern: { kind: "any" } }`.
- `skip` MUST be a reserved keyword and MUST NOT parse as a bare rule-reference
  identifier; `@skip` still references a rule named `skip`.

Postconditions:

- `(string | skip)*` parses to a quantifier over an `or` whose second branch is
  the bare-skip form.

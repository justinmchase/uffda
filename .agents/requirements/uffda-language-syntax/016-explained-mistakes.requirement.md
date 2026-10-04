---
id: uffda-language-syntax-016
title: Common mistakes are reported where they occur, with an explanation
spec_ref: ".agents/specifications/runtime/match-diagnostics.spec.md#explanations"
---

# Explained Mistakes

Refines
[failure focus](../../specifications/runtime/match-diagnostics.spec.md#failure-focus)
and
[explanations](../../specifications/runtime/match-diagnostics.spec.md#explanations)
for the built-in Uffda grammar, whose rules are explained by their
`[Documentation]` `error` (see
[editor metadata](../../specifications/languages/cli/editor-metadata.spec.md)).

## Requirement

Preconditions:

- A Uffda module containing one common mistake: a missing or misplaced
  delimiter, keyword, name, `=`, `;`, operand, bound, or value; or a comment
  after code inside a declaration.

Expected behavior:

- The module's first diagnostic MUST point at the source offset where the
  mistake occurred: the unexpected token, or the end of the construct when
  something is missing there.
- The diagnostic MUST lead with the explanation of the rule that began at that
  point, describing the mistake specifically (for example a missing `)` that
  closes a group, rather than every token that could follow).

Postconditions:

- The corpus of mistakes is kept as a test. A grammar change that loses one of
  these explanations or moves its focus fails that test.

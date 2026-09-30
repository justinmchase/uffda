---
id: uffda-language-syntax-013
title: Comments appear only between top-level declarations and stay in the syntax tree
spec_ref: ".agents/specifications/languages/uffda-syntax/module-structure.spec.md#comments"
---

# Comments Between Declarations

## Requirement

Preconditions:

- A Uffda module contains `#` line comments.

Expected behavior:

- Comments before the first declaration, between declarations (including among
  imports, among exports, and between those groups), and after the last
  declaration MUST parse.
- Each such comment MUST appear in the syntax tree's `declarations` sequence as
  `{ kind: "comment", text }`, with `text` starting with `#`, in source order
  relative to the surrounding declarations.
- A module consisting only of comments MUST parse to a module whose
  `declarations` are those comment nodes.
- A comment inside a declaration (for example inside a rule body) MUST fail to
  parse.
- A comment after a declaration's closing `;` on the same line MUST parse as a
  comment between declarations.
- A `#` inside a quoted string MUST remain string content and MUST NOT be
  treated as a comment.

Postconditions:

- Compiling a module drops its comment nodes: the ModuleDeclaration is the same
  as for the module with its comments removed.

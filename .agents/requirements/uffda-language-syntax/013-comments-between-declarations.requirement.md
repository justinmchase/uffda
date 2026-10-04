---
id: uffda-language-syntax-013
title: Comments between top-level declarations stay in the syntax tree
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
- Each comment block (consecutive comments with no declaration between them)
  MUST appear in the syntax tree's `declarations` sequence as one
  `{ kind: "comment", blocks }` node (see comment-syntax-001), in source order
  relative to the surrounding declarations.
- A module consisting only of comments MUST parse to a module whose
  `declarations` is that one comment node.
- Comments inside declarations are covered by uffda-language-syntax-015.
- A comment after a declaration's closing `;` on the same line MUST parse as a
  comment between declarations.
- A `#` inside a quoted string MUST remain string content and MUST NOT be
  treated as a comment.
- A fence tagged `uffda` MUST be parsed as a Uffda module. With no project
  languages declared (no `uffda.jsonc`, #235), a fence with any other tag except
  `text` MUST fail to parse.

Postconditions:

- Compiling a module drops its comment nodes: the ModuleDeclaration is the same
  as for the module with its comments removed.

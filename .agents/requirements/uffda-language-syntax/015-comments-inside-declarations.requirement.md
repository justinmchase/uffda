---
id: uffda-language-syntax-015
title: Comments on their own lines inside declarations
spec_ref: ".agents/specifications/languages/uffda-syntax/module-structure.spec.md#comments"
---

# Comments Inside Declarations

Refines the module comment policy together with
[pattern comments](../../specifications/languages/pattern-syntax/grammar.spec.md#comments),
[structuring](../../specifications/languages/expression-syntax/array-and-object-structuring.spec.md),
[invocation](../../specifications/languages/expression-syntax/function-invocation.spec.md),
[runtime compilation](../../specifications/languages/uffda-runtime-compilation.spec.md#compilation-boundary),
and
[formatting](../../specifications/languages/uffda-syntax/formatting.spec.md#comments).

## Requirement

Preconditions:

- A rule, func, or decorator body contains `#` line comments on their own lines.

Expected behavior:

- A comment on its own line MUST parse cleanly, whatever its text, when it sits
  before the first alternative, on the lines before a later alternative's `|`
  (or before a `&` or `|>`), between sequence elements, between array elements,
  before or after object entries, or between invocation arguments. Its comment
  node MUST be kept in that list in source order.
- Commenting out the alternatives of an alternation down to one MUST still
  parse, and the alternation MUST keep its comment nodes.
- A comment that follows code on the same line inside a declaration MUST be a
  syntax error. Recovery MUST skip only that comment, so the declaration around
  it still parses. When the comment follows a pattern member, an alternative, an
  array element, an invocation argument, or an object entry's value, the
  diagnostic MUST lead with an explanation that comments must be on their own
  lines inside a declaration (the `[Documentation]` `error` of `CommentNode`).

Postconditions:

- Compiling drops comments inside declarations: the ModuleDeclaration is the
  same as for the module with those comments removed, with alternations,
  conjunctions, sequences, and pipelines left with one member compiled as that
  member.
- Formatting writes each inner comment on its own lines and breaks the
  constructs that hold it, and formatting the result again changes nothing.

---
id: comment-syntax-001
title: Comment blocks parse into paragraphs, lists, and fences with strict errors
spec_ref: ".agents/specifications/languages/comment-syntax.spec.md"
---

# Structured Comment Blocks

## Requirement

Preconditions:

- The comment grammar receives the comment tokens of one comment block and a
  fence parser rule parameter.

Expected behavior:

- A line's content MUST exclude the leading `#` and one following space.
- Blank comment lines MUST separate blocks and MUST NOT appear in the output.
- Consecutive non-blank lines that are not list items or fences MUST form one
  paragraph whose text is the lines joined with single spaces.
- A line starting with `-` MUST begin a list item. The item MUST continue on
  following lines until a blank line, the next item, or a fence. Consecutive
  items MUST form one list.
- Leading and trailing whitespace outside a fence MUST NOT affect the output.
- A fence MUST open with a line starting with `` ``` `` and an optional tag, and
  close with a line that is only `` ``` `` (and whitespace). Its code MUST be
  its lines joined with newlines, whitespace preserved.
- Untagged fences and `text` fences MUST NOT be passed to the fence parser and
  MUST have no `tree`.
- Other fences MUST be passed to the fence parser as `{ language, code }`, and
  its value MUST become the fence's `tree`.
- Paragraph and list item text MUST split into text and code inlines, where code
  is a backtick-delimited, non-empty run without backticks, which may span
  lines.

Error behavior (each is a syntax error in the containing file):

- An unclosed fence.
- An unclosed inline code span.
- A fence tag the fence parser rejects.
- Fenced code that its language's grammar does not parse cleanly.

Postconditions:

- The output is `{ kind: "comment", blocks }` with blocks in source order, as
  defined in the comment syntax chapter.

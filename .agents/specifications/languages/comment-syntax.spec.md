# Comment syntax

This chapter defines the structured syntax of comment text: a small, strict,
Markdown-like language that any language grammar can reuse for its comments.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

Comments are part of a language's syntax tree (see
[tokenization](./tokenization.spec.md#comment-trivia)). Parsing their text into
paragraphs, lists, and fenced code lets tooling (a formatter, hover
documentation) work with comment structure instead of raw text, and lets code
examples in comments be checked by their own grammar.

## Input

- The comment grammar's input MUST be the comment tokens of one comment block:
  consecutive comment tokens with nothing but trivia between them, in source
  order. Each comment token is one source line.
- A comment line's content MUST be its token text without the leading `#` and
  without one following space, when present.
- Blank source lines carry no meaning. Two comment groups separated only by
  blank source lines are one comment block.

## Blocks

A comment block MUST parse as a sequence of blocks separated by blank comment
lines (a line whose content is empty or only whitespace). Outside a fence,
leading and trailing whitespace on a line carries no meaning.

- **Paragraph:** one or more consecutive lines that are not blank, do not begin
  a list item, and do not open a fence. Its text is its lines joined with single
  spaces.
- **List:** one or more consecutive list items. An item MUST begin with a line
  whose content starts with `-`. The item continues on each following line until
  a blank line, the next item, or a fence. Its text is its lines joined with
  single spaces, without the `-` marker. Lists are flat: there is no nesting.
- **Fence:** a line whose content is `` ``` `` followed by an optional language
  tag, then zero or more lines of code, then a line whose content is only
  `` ``` `` (surrounding whitespace carries no meaning on either delimiter
  line). Fence lines are code: whitespace inside a fence is preserved exactly as
  written, and nothing inside a fence is a list, paragraph, or inline code.
- A block MAY be followed directly by another block of a different kind without
  a blank line between them, except that a paragraph line directly after a list
  item continues that item.

## Inline content

Paragraph and list item text MUST parse as a sequence of inlines:

- **Code:** a backtick, one or more characters that are not backticks, and a
  closing backtick. It may span lines of its paragraph or item.
- **Text:** a run of characters that are not backticks.

## Fenced code

- The comment grammar MUST take the parser for fenced code as a rule parameter,
  so it has no knowledge of any particular language. The host language's grammar
  supplies it.
- The fence parser MUST receive each fence as `{ language, code }`, where
  `language` is the tag (the empty string when absent) and `code` is the fence's
  lines joined with newlines.
- A fence with no tag or with the tag `text` MUST be kept as written and not
  parsed.
- A fence with any other tag MUST be parsed by the fence parser. The tag names a
  language by its `[Language]` id. A tag the fence parser does not accept, or
  code its language's grammar does not parse cleanly, MUST be a syntax error.
- The languages a fence tag can name are the host language itself plus the
  languages declared in the project's `uffda.jsonc` (#235). A tag MUST NOT
  resolve to a language the project has not declared, even if a grammar with
  that id exists elsewhere.

## Errors

Errors are strict. Each of the following MUST be a syntax error in the file
containing the comment, reported like any other syntax error (see
[error recovery](../runtime/error-recovery.spec.md)):

- a fence with no closing `` ``` `` line;
- an inline code span with no closing backtick;
- a fence tag the fence parser does not accept;
- fenced code that does not parse cleanly with its language's grammar.

## Output

A comment block MUST project to a comment node:

```
{ kind: "comment", blocks: Block[] }
Block  = { kind: "paragraph", inlines: Inline[] }
       | { kind: "list", items: { inlines: Inline[] }[] }
       | { kind: "fence", language: string, code: string, tree?: unknown }
Inline = { kind: "text", text: string } | { kind: "code", text: string }
```

- A fence's `tree` is the value its language's grammar produced; it is absent
  for untagged and `text` fences.
- A comment block with no blocks (only blank comment lines) MUST project to
  `{ kind: "comment", blocks: [] }`.

## Composition intent

- The comment grammar SHOULD stay small. New block kinds (for example headings
  for literate documents, #239) are added here, not in individual languages.
- Comment structure is line-based only because each comment token is one line.
  It is not indentation-sensitive (see
  [languages](../languages.spec.md#language-layering-intent)).

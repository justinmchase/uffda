---
id: cli-language-server-008
title: Document formatting replaces the document with the formatter's output, and never formats an unclean parse
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#formatting"
---

# Formatting

## Requirement

Preconditions:

- A document of a configured language is open (003).

Expected behavior:

- The server MUST advertise `documentFormattingProvider`.
- `textDocument/formatting` MUST return one edit replacing the whole document
  with the text the language's `[Formatter]` produces from the document's
  current parse, or no edits when the text is already formatted.
- It MUST return no edits when the current text did not parse cleanly, or the
  language has no `[Formatter]`.
- Client formatting options MUST NOT change the result.
- Formatting MUST NOT change the document's parse state.

Postconditions:

- The edit's text equals what `uffda fmt` writes for the same text (see
  `cli-fmt-001`).

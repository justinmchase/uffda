---
id: cli-language-server-009
title: uffda/toggleComment toggles the lines a range touches with the language's [ToggleComment] rule
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#comment-toggling"
---

# Comment Toggling

## Requirement

Preconditions:

- A document of a configured language is open (003).

Expected behavior:

- The server MUST advertise `experimental.uffdaToggleComment` and handle the
  custom `uffda/toggleComment` request with params
  `{ textDocument: { uri }, range }`.
- The request MUST toggle the whole lines `range` touches, leaving out a later
  line the range only reaches the start of, by running the rule the language's
  entry rule names with `[ToggleComment]` on the text of those lines (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#comment-toggling)).
- It MUST return one edit replacing those lines, without the last line's line
  ending, with the rule's text.
- It MUST return no edits when the language has no `[ToggleComment]`, the rule
  fails or produces no text, or the text would not change.
- It MUST work on the document's current text, whether or not it parses, and
  MUST NOT change the document's parse state.
- For `.uff`, `UffdaLang` names `ToggleHashComment`: lines whose non-blank lines
  are all `#` comments lose their `#` and one following space; otherwise each
  non-blank line gets `#` at the smallest indentation among them. Blank lines
  and line endings are kept.

Postconditions:

- Toggling the same lines twice restores lines that were all uncommented, or all
  commented with `#`.

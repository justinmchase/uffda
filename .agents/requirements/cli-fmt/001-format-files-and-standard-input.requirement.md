---
id: cli-fmt-001
title: uffda fmt formats files by language, checks without writing, and never rewrites an unclean parse
spec_ref: ".agents/specifications/languages/cli/formatting.spec.md"
---

# Format Files and Standard Input

## Requirement

Preconditions:

- `uffda fmt` receives one or more file paths and/or glob patterns, or `-`, with
  optional `--check` and `--json`.

Expected behavior:

- Each file's language MUST be chosen by extension from the built-in `.uff`
  language and `.uffda/lsp.jsonc`, and the file formatted with the formatter its
  language's entry rule names with `[Formatter]`.
- A file whose formatted text differs MUST be rewritten in place and listed as
  `changed`; a formatted file MUST be `unchanged` and not written.
- With `--check`, no file MUST be written; non-canonical files MUST be listed as
  `changed` and the command MUST exit non-zero.
- A file that fails to parse or parses only by recovering MUST NOT be rewritten;
  its parse diagnostics MUST be reported with source locations and the command
  MUST exit non-zero.
- A missing path, a glob matching no file, an extension no language owns, and a
  language without `[Formatter]` MUST each be reported as a failure with a
  non-zero exit.
- `-` MUST format standard input as `.uff` and write the formatted text to
  standard output.
- Without `--json`, changed paths MUST go to standard output and diagnostics to
  standard error as `path:line:column: message`; with `--json`, the result MUST
  be `{ ok, check, files }`.
- Options other than paths, `-`, `--check`, and `--json` MUST be rejected, as
  MUST `--check` on any other command.

Postconditions:

- `uffda fmt` and the language server produce the same text for the same
  document.

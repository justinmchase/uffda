# Formatting command

This chapter defines `uffda fmt`, which formats source files with the formatter
their language's grammar names. See
[#238](https://github.com/justinmchase/uffda/issues/238).

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Logical purpose

A language's canonical layout is part of the language: its grammar names a
formatter rule with `[Formatter X]` (see
[editor metadata](./editor-metadata.spec.md#formatting)). `uffda fmt` applies
that formatter to files on disk so a workspace and CI can keep them canonical,
with the same languages and the same results as the
[language server](./language-server.spec.md#formatting).

## Invocation

```sh
uffda fmt
uffda fmt --check
uffda fmt <file-or-glob> [...more paths]
uffda fmt -
```

- Without paths, `fmt` MUST format every file under the working directory, as if
  given the glob `**/*`, without failing when nothing matches.
- `fmt` MUST accept file paths and glob patterns, resolved against the working
  directory. A glob that matches no file, a missing path, and a path that is not
  a file MUST each be reported as a failure.
- Globs, including the default, MUST NOT descend into `.git` or `node_modules`
  directories.
- `-` MUST format standard input as a `.uff` module and write the formatted text
  to standard output; it MUST NOT be combined with paths.
- `fmt` MUST accept only paths, `-`, `--check`, and `--json`, and MUST reject
  every other option with a usage failure. `--check` MUST be rejected by every
  other command.

## Languages

- A file's language MUST be chosen by its extension, exactly as the language
  server chooses it: the built-in `.uff` language or a language declared in
  `.uffda/lsp.jsonc` under the working directory (see
  [language configuration](./language-server.spec.md#language-configuration)).
- Formatting is opportunistic for files matched by a glob (including the
  default): a file whose extension no language owns, or whose language's entry
  rule has no `[Formatter]`, MUST be skipped silently and left out of the
  results.
- A file named by an explicit path MUST be formatted: if no language owns its
  extension, or its language has no `[Formatter]`, that MUST be reported as a
  failure.
- A language whose grammar cannot be loaded MUST be reported as a failure for
  each of its files, whether named or matched.
- An invalid `.uffda/lsp.jsonc`, or one in which two or more languages claim the
  same extension (see
  [language configuration](./language-server.spec.md#language-configuration)),
  MUST fail the command with a configuration failure.

## Formatting

- Each file MUST be parsed with its language's grammar and its parse value
  formatted by the language's formatter.
- A file that fails to parse, or parses only by recovering, MUST NOT be
  rewritten; its parse diagnostics (one per recovery, then the failure) MUST be
  reported with source locations.
- A formatter that fails, or produces something other than a string, MUST be
  reported as a failure for that file.
- Without `--check`, a file whose formatted text differs MUST be rewritten in
  place, and a file already formatted MUST NOT be written.
- With `--check`, no file MUST be written.

## Output and exit codes

- Each file MUST have one result: `unchanged`, `changed` (rewritten, or with
  `--check`, not formatted), or `failed` with its diagnostics.
- Without `--json`, the paths of changed files MUST be written to standard
  output one per line, relative to the working directory, and each diagnostic to
  standard error as `path:line:column: message` (or `path: message` without a
  location). Standard input formatting writes the formatted text instead of its
  path, unless `--check` is set.
- With `--json`, the command MUST write `{ ok, check, files }` to standard
  output, each file carrying its `sourcePath`, `status`, language id when known,
  and diagnostics; standard input results also carry the formatted `text` unless
  `--check` is set.
- The command MUST exit non-zero when any file fails, or with `--check` when any
  file is changed, and zero otherwise.

## Related

- [editor metadata](./editor-metadata.spec.md#formatting) — the `[Formatter]`
  decorator.
- [Uffda source formatting](../uffda-syntax/formatting.spec.md) — the `.uff`
  language's canonical format.
- [language server](./language-server.spec.md#formatting) — editor formatting.

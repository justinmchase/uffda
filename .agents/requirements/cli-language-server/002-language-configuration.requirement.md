---
id: cli-language-server-002
title: The server serves the languages the project file lists, described by their grammars' [Language] metadata
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#language-configuration"
---

# Language Configuration

## Requirement

Preconditions:

- `uffda lsp` is started with a workspace root (the editor's reported workspace
  folder, or the process `cwd` when none is reported).

Expected behavior:

- The server MUST read the nearest `uffda.jsonc` at or above the workspace root
  (see [project file](../project-file/001-project-file.requirement.md)) and
  serve the built-in `.uff` language plus every language the modules in its
  `languages` declare.
- Each language MUST be described by
  `[Language { id, name?, description?,
  extensions }]` on an exported rule of
  its module, and parsed with that rule. The project file has no per-language
  fields.
- `.uff` itself MUST be declared through the same `[Language]` metadata, on
  `UffdaLang` in `src/lang/uffda/uffda.lang.uff` — the server MUST NOT
  special-case `.uff` through a code path unavailable to a project language.
- A project language claiming an id or extension of the built-in `.uff` language
  MUST take it over.
- An id or extension claimed by two or more project languages MUST be reported,
  naming it (and, for an extension, the languages); none of them MUST serve it,
  and their other extensions MUST remain served.
- A document whose extension no language owns MUST be ignored by the server (no
  diagnostics, highlighting, or other features offered for it) rather than
  causing a startup or per-document failure.
- A missing project file MUST NOT be reported: the server serves `.uff` alone.
- An invalid project file, or a `languages` entry whose module cannot be read,
  compiled or resolved, or declares no language, MUST be reported in the
  server's log and MUST NOT crash the server; the server MUST still serve every
  language it could load and respond to LSP lifecycle messages (`initialize`,
  `shutdown`).
- The `uffda/languageMetadata` request MUST answer
  `{ languages: [{ id, name?, description?, extensions }] }` for every served
  language (or only the one named by `languageId`), with extensions lowercased
  and keeping their dot.

Postconditions:

- Every document the editor opens is served by exactly one language (chosen by
  extension) or is not served at all; there is no ambiguity or fallback grammar
  guessing.

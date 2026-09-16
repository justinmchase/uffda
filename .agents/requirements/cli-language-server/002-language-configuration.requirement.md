---
id: cli-language-server-002
title: A workspace configuration file declares which grammar backs each served language
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#language-configuration"
---

# Language Configuration

## Requirement

Preconditions:

- `uffda lsp` is started with a workspace root (the editor's reported workspace
  folder, or the process `cwd` when none is reported).

Expected behavior:

- The server MUST read a workspace configuration file at
  `<workspace>/.uffda/lsp.jsonc`, mirroring the existing `.uffda` artifact-root
  convention (see `DEFAULT_SESSION_ARTIFACT_ROOT` in `src/cli/mcp.session.ts`).
- The configuration file MUST declare a list of served languages, each
  specifying at minimum: a language id, one or more file extensions that map to
  it, the compiled grammar module to load, and the entry rule name to parse with
  — the same three inputs `parseGrammar`/`uffdaGrammar`-shaped grammar entry
  points already require (`moduleUrl`, `entryRuleName`, plus an implicit
  language id for editor-facing display).
- `.uff` itself MUST be configurable through this same file and mechanism — the
  server MUST NOT special-case `.uff` through a code path unavailable to a
  user-declared language entry.
- Design note (non-normative for this requirement, see the spec chapter's
  "Language configuration" section): implementations SHOULD avoid hard-coding
  assumptions that a language's file extension(s) can only ever come from this
  file. A grammar module MAY self-declare its own extension(s) (and other
  editor-facing facts) via `[Language { ext: ".uff", … }]` metadata on its entry
  rule. When a language entry omits `extensions` but supplies `modulePath` and
  `entryRuleName`, the server MUST fill `extensions` from that metadata's `ext`
  (workspace JSON still wins when `extensions` is present). Attribute
  application uses `[Name arg…]` expression arguments (see
  [declaration attribute syntax](../../specifications/languages/uffda-syntax/declaration-attributes.spec.md));
  a form like `[Language ext: ".uff"]` is not valid Uffda syntax.
- A document whose extension does not match any configured language entry MUST
  be ignored by the server (no diagnostics, highlighting, or other features
  offered for it) rather than causing a startup or per-document failure.
- A missing configuration file MUST be a deterministic, reported condition (for
  example a single startup diagnostic/log to standard error) rather than a
  silent no-op or a crash; the server MUST still start and MUST still respond to
  LSP lifecycle messages (`initialize`, `shutdown`) even with zero configured
  languages.
- A configuration file that fails to parse or that references a grammar module
  that cannot be resolved MUST be reported the same deterministic way (per this
  chapter's conventions) and MUST NOT crash the server process; the affected
  language entry MUST simply be unavailable, and other, validly-configured
  language entries in the same file MUST remain available.

Postconditions:

- Every document the editor opens is served according to exactly one
  configuration entry (chosen by extension) or is not served at all; there is no
  ambiguity or fallback grammar guessing.

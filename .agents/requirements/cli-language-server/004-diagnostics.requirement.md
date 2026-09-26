---
id: cli-language-server-004
title: Diagnostics are republished after every change and attributed to the responsible pipeline stage
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#diagnostics"
---

# Diagnostics

## Requirement

Preconditions:

- A document has been opened or changed (003).

Expected behavior:

- The server MUST publish `textDocument/publishDiagnostics` reflecting every
  parse, compile, and resolution failure for the document, translating the same
  underlying failure information the batch CLI and MCP server already surface
  (for example `getRightmostFailure` / match-failure analysis in
  `src/match.visualize.ts`) into LSP diagnostic ranges (line/character
  positions, not raw stream offsets).
- Parse-failure diagnostic messages MUST lead with what was **expected** for the
  match to succeed, then what was found, so editors that already underline the
  unexpected token still make the missing alternative obvious (see
  [match diagnostics](../../specifications/runtime/match-diagnostics.spec.md)).
  When a terminal expectation is unavailable, the message MUST still name the
  pattern/rule being matched.
- Diagnostics MUST be republished after every `didChange`, including a change
  whose affected region, under incremental re-parsing, did not actually alter
  any diagnostic — the published set MUST always reflect current content, never
  a stale set from a prior version.
- A diagnostic produced by a downstream pipeline stage MUST be reported at a
  source-facing range attributable back to the original document text, not at an
  internal/intermediate stage's own coordinate space, and MUST NOT be merged
  into or hidden behind an upstream stage's diagnostic for the same or a
  different location.
- When only trivia (whitespace, line breaks, comments) containing a line break
  separates a parse failure's unexpected token from the last significant token
  before it, the diagnostic MUST be a zero-width range immediately after that
  preceding token (the unfinished construct), not on the later line's token. An
  unexpected token on the same line is ranged on that token.
- A resolution failure attributable to one of the document's import declarations
  MUST be ranged on that declaration's module specifier string (for example
  `"./dep.uff"` in `import "./dep.uff" A;`), or on the imported name itself when
  the failure is about that name (for example `A` when `./dep.uff` does not
  export `A`, or `A` conflicts with a local declaration). This covers:
  - a module whose source file does not exist (the message MUST name the
    specifier and the missing path, not an artifact-compilation instruction);
  - a dependency whose own source fails to parse/compile (the diagnostic MUST
    carry `relatedInformation` pointing at the dependency's failure position
    when known);
  - a failure further down that import's transitive import graph (the message
    MUST name the root import, and the failure is attributed to the root import
    through the module-runtime import chain, see
    [modules-runtime 005](../modules-runtime/005-import-failures-carry-import-chain.requirement.md)).
- Failures that carry no source location (for example a compile failure of the
  document itself, or a resolution failure not caused by an import) MUST fall
  back to a whole-document range.
- A document with zero failures MUST publish an empty diagnostics array (not
  omit publishing), so the editor can clear any previously shown diagnostics for
  that document version.
- Diagnostic severity MUST distinguish at minimum parse/compile/resolution
  failures (errors) from any advisory-level findings the server chooses to
  surface (warnings/information), consistent with LSP's `DiagnosticSeverity`.

Postconditions:

- The editor's diagnostic panel for an open document always matches what a
  fresh, non-incremental parse of that document's current content would report.

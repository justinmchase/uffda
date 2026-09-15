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
  (for example `getRightmostFailure` in `src/match.ts`) into LSP diagnostic
  ranges (line/character positions, not raw stream offsets).
- Diagnostics MUST be republished after every `didChange`, including a change
  whose affected region, under incremental re-parsing, did not actually alter
  any diagnostic — the published set MUST always reflect current content, never
  a stale set from a prior version.
- A diagnostic produced by a downstream pipeline stage MUST be reported at a
  source-facing range attributable back to the original document text, not at an
  internal/intermediate stage's own coordinate space, and MUST NOT be merged
  into or hidden behind an upstream stage's diagnostic for the same or a
  different location.
- A document with zero failures MUST publish an empty diagnostics array (not
  omit publishing), so the editor can clear any previously shown diagnostics for
  that document version.
- Diagnostic severity MUST distinguish at minimum parse/compile/resolution
  failures (errors) from any advisory-level findings the server chooses to
  surface (warnings/information), consistent with LSP's `DiagnosticSeverity`.

Postconditions:

- The editor's diagnostic panel for an open document always matches what a
  fresh, non-incremental parse of that document's current content would report.

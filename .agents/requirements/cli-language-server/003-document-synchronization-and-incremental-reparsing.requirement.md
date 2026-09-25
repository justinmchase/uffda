---
id: cli-language-server-003
title: Document synchronization drives incremental re-parsing per pipeline stage
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#document-synchronization-and-incremental-re-parsing"
---

# Document Synchronization and Incremental Re-parsing

## Requirement

Preconditions:

- A document has been opened for a configured language entry (002).

Expected behavior:

- `textDocument/didOpen` MUST trigger a full parse of the document's initial
  content against the configured grammar/entry rule.
- `textDocument/didChange` MUST translate the reported change(s) into an edit
  description (replaced span plus replacement content) and feed it into the
  runtime using
  [incremental re-parsing](../../specifications/runtime/incremental-parsing.spec.md),
  reusing memoized parse state for any pipeline stage whose affected region the
  runtime can establish, and falling back to a full re-parse of that stage
  whenever reuse cannot be established — matching `rehydrateMemos`'s existing
  conservative-fallback contract (`src/runtime/incremental.ts`).
- For a document processed through more than one pipeline stage (see
  "Multi-stage pipelines" in the incremental-parsing spec), each stage's
  affected region and reuse decision MUST be computed independently from its own
  upstream stage's delivered output, not derived by reapplying the original
  editor-reported edit's raw offsets to every stage.
- `textDocument/didClose` MUST release any retained parse/memo state for that
  document; a later `didOpen` for the same URI MUST behave as a fresh full
  parse, not resume stale state.
- Incremental re-parsing MUST be an optimization only: the diagnostics,
  highlighting, hover, and navigation results the server derives from an
  incrementally re-parsed document MUST be indistinguishable from the results of
  a full re-parse of the same post-edit content.
- The server MUST NOT begin processing a new `didChange` for a document while a
  prior change for that same document is still being incrementally applied;
  edits for a single document MUST be processed in the order received. This
  holds even when the client sends changes without waiting (LSP notifications
  are not acknowledged), and queries for a document (semantic tokens, hover,
  definition, completion) MUST be answered from the state after every change
  received before them, never from a partially applied change.

Postconditions:

- Every currently-open document's server-side parse state accurately reflects
  its most recently reported content, for every configured pipeline stage.

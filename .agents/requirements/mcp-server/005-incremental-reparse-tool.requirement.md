---
id: mcp-server-005
title: Incremental re-parse produces the same outcome as a full reload, reusing unaffected parse state
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#incremental-re-parse-tools"
---

# Incremental Re-parse Tool

## Requirement

Preconditions:

- A session has already loaded a source file (004).
- An edit (a region replacement: start offset, end offset, replacement text) is
  provided against that already-loaded file within the session.

Expected behavior:

- The tool MUST reprocess only the region affected by the edit, reusing memoized
  parse results for regions unaffected by the edit, per
  `.agents/specifications/runtime/incremental-parsing.spec.md`.
- The tool's result (resolved module state, diagnostics, exported members) MUST
  be indistinguishable from the result of closing and re-loading the full
  post-edit source from scratch in an equivalent fresh session — incremental
  processing MUST NOT change the outcome, only the amount of work performed.
- An edit that introduces a parse or resolution failure MUST report diagnostics
  the same way a full load failure would (004).
- Applying a second edit after a first MUST compose correctly: the session's
  state after two sequential incremental edits MUST equal the state after one
  incremental edit covering the same net change.

Postconditions:

- Repeated small edits to a large file remain fast relative to full reloads,
  without ever producing a result a full reload would not have produced.

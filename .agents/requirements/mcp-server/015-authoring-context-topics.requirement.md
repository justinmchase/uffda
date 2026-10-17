---
id: mcp-server-015
title: Authoring context topic mode returns exact syntax without unrelated unsupported verdicts
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#authoring-context-tool"
---

# Authoring Context Topics

## Requirement

Preconditions:

- The MCP server is running. No session needs to be open.

Expected behavior:

- `uffda_authoring_context` MUST accept optional `topics` (string ids or
  aliases) in addition to `task` / `language`.
- When topics are requested, the response MUST include a `topics` array. Each
  entry MUST provide: topic id, exact syntax summary, one minimal verified
  example, caveats, and concise source citations. The same evidence MUST NOT be
  duplicated across unrelated sections.
- Topic mode MUST cover at least: bounded/exact repetition (`*n..n` vs `*n`),
  pipeline scalar stages and `[Pattern]`/`into`, projection vs pipeline
  grouping, skip vs quantifier counting/collection, character classes vs ASCII
  digits, capture scope / repeated bindings, and module exports.
- A query about character classes or repetition MUST NOT be classified
  `unsupported` solely because an unrelated restriction (for example
  statement-like `if`/loops) shared a loose keyword with the task.
- Expressibility assessments, when present, MUST separate language facts from
  unverified conclusions and MUST NOT treat missing reference implementations as
  proof that a construct is impossible.

Postconditions:

- Tests: `src/cli/mcp.authoring_context.test.ts` cites `req:mcp-server-015`.

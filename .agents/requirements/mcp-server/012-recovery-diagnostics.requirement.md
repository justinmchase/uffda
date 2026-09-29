---
id: mcp-server-012
title: MCP tools report every recovery and retain recovered match trees
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#error-and-determinism-contract"
---

# MCP Recovery Diagnostics

## Requirement

Preconditions:

- A tool parses source (`uffda_parse`, `uffda_match`, `uffda_compile`,
  `uffda_highlight`, session load/patch/eval/query) or matches input
  (`uffda_match`, session eval with a rule).

Expected behavior:

- The parse or match MUST request error recovery.
- A failure MUST carry a `diagnostics` list of every diagnostic of the parse or
  match, in document order.
- A result that succeeded only by recovering MUST be a failure whose `error` is
  its first recovery, and MAY carry the recovered `value`.
- A module source that parsed only by recovering MUST NOT be committed to the
  session.
- A rule invocation that succeeded only by recovering MUST retain its match tree
  under a `matchResultId` (on its `error`), and walking it MUST mark recovered
  nodes with `recovered: true`.

## Test plan

`src/cli/mcp.session.test.ts` ("cli.mcp.session reports recoveries"),
`src/cli/mcp.static_tools.test.ts` ("matchToolHandler reports recoveries").

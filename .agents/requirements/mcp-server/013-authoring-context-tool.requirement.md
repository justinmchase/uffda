---
id: mcp-server-013
title: Authoring context tool returns evidence-based syntax, semantics, and expressibility for a task
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#authoring-context-tool"
---

# Authoring Context Tool

## Requirement

Preconditions:

- The MCP server is running. No session needs to be open.

Expected behavior:

- The server MUST expose a tool named `uffda_authoring_context`.
- The tool MUST accept a `task` string and/or `topics` array describing what the
  caller wants, and an optional `language` selecting `uffda`, `pattern`, or
  `expression` when the caller already knows which grammar applies. At least one
  of `task` or `topics` MUST be non-empty.
- A successful result MUST be a JSON object with `ok: true` and structured
  fields covering syntax, semantics, expressibility, restrictions, and sources
  relevant to `task`.
- Every substantive claim in the result MUST cite at least one
  repository-relative source reference. When the referenced file is readable
  from the running package, the reference MUST include line numbers; otherwise
  it MUST still include the path and a short excerpt.
- The tool MUST NOT invent Uffda syntax or default globals that are absent from
  the implementation's inventory. Unsupported or uncertain capabilities the task
  implies MUST be listed explicitly rather than omitted.
- For a task that asks to sort an array of numbers, the result MUST report
  comparison and collection primitives that exist (for example `compare`,
  `reduce`, `at`, `slice`) as supported when they match the task, MUST flag the
  absence of a `sort` global and of in-place array mutation/swap as unsupported
  when those are implied, and MUST NOT change language behavior merely to make
  that assessment pass.
- The tool MUST NOT require or accept a session id and MUST NOT persist state
  between calls.
- An empty request (no non-empty `task` and no `topics`) MUST fail with a
  machine-consumable error (`ok: false`, `error.code`, `error.phase`,
  `error.message`) rather than returning guessed context.

Postconditions:

- An agent can obtain verified authoring context for an unfamiliar task without
  shelling out to ad hoc docs search.
- Tests: `src/cli/mcp.authoring_context.test.ts` (and MCP registration coverage
  in `src/cli/mcp.test.ts`).

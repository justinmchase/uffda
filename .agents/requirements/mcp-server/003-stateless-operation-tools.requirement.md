---
id: mcp-server-003
title: Stateless parse/compile/match tools match their CLI counterparts' output and diagnostics
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#stateless-operation-tools"
---

# Stateless Operation Tools

## Requirement

Preconditions:

- The MCP server is running. No session needs to be open.

Expected behavior:

- The server MUST expose a tool equivalent to `uffda compile` (source/glob to
  Uffda syntax AST artifacts).
- The server MUST expose a tool equivalent to `uffda parse` (source to raw AST
  JSON, with the same `--lang` language-selection semantics: full Uffda,
  pattern, or expression).
- The server MUST expose a tool equivalent to `uffda match` (pattern matching
  against explicit subject input, text or JSON).
- For equivalent input, each stateless tool MUST produce output identical in
  structure and content to its corresponding CLI command's machine-readable
  (`--json`) output, and MUST produce diagnostics with the same error code,
  phase, and message content on failure.
- These tools MUST NOT require or accept a session id; they MUST NOT persist any
  state between calls.

Postconditions:

- An agent can validate a snippet of source (parse/compile/match) without
  opening a session, exactly as it could via a one-shot CLI invocation.

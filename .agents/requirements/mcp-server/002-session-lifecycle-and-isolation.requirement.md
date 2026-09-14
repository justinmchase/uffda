---
id: mcp-server-002
title: Sessions are isolated, id-addressed, in-memory runtimes with deterministic lifecycle failures
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#session-model"
---

# Session Lifecycle and Isolation

## Requirement

Preconditions:

- The MCP server process is running and has received an "open session" tool
  call.

Expected behavior:

- Opening a session MUST return a stable session id that uniquely identifies
  that session for the lifetime of the server process.
- The server MUST support multiple concurrently open sessions.
- Any tool call that accepts a session id MUST resolve state (loaded modules,
  resolver, incremental parse state) scoped to that session only. No mutation
  performed against one session id MUST be observable through any other session
  id.
- Closing a session MUST release all of its in-memory state (loaded modules,
  resolver, and any incremental parse state) such that it is no longer reachable
  through any tool call.
- A tool call referencing a session id that was never opened, or that was
  already closed, MUST fail deterministically with a machine-consumable error
  (see 010-error-and-determinism-contract) rather than implicitly creating a new
  session or reusing another session's state.
- Session state MUST NOT be persisted to disk and MUST NOT survive a server
  process restart; a new server process MUST start with zero open sessions.

Postconditions:

- Two sessions loading the same source file independently produce independent,
  non-interfering resolved module graphs.

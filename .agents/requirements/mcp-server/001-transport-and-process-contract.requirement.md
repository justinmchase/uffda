---
id: mcp-server-001
title: uffda mcp starts a stdio-only MCP server reserved for protocol traffic
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#transport-contract"
---

# Transport and Process Contract

## Requirement

Preconditions:

- The CLI is invoked as `uffda mcp`.

Expected behavior:

- The process MUST start an MCP server communicating over standard input and
  standard output using the standard MCP stdio transport.
- The process MUST NOT open a network listener unless a future explicit flag
  requests one; `uffda mcp` with no flags MUST be stdio-only.
- Standard input/output MUST carry only MCP protocol frames (requests,
  responses, notifications) for the lifetime of the process. Human-readable
  logging, if any, MUST go to standard error, never standard input/output.
- The command MUST follow the same `CliMode`/contract dispatch pattern as
  `compile`/`exec`/`match`/`parse`/`run`/`workbench` in `main.ts`/`contract.ts`,
  including deterministic exit codes and error shape for startup failures (for
  example invalid flags).

Postconditions:

- Nothing written to stdout/stdin by the server is ever something other than a
  well-formed MCP protocol message.

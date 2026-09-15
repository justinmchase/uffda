---
id: cli-language-server-001
title: uffda lsp starts a stdio-only LSP server as a mode of the existing CLI binary
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#server-mode-and-invocation"
---

# Server Mode and Invocation

## Requirement

Preconditions:

- The CLI is invoked as `uffda lsp`.

Expected behavior:

- The process MUST start a Language Server Protocol server communicating over
  standard input and standard output using the standard LSP stdio transport.
- `uffda lsp` MUST be a mode of the existing `uffda` CLI binary — the same
  binary/entry point that serves `compile`/`exec`/`match`/`parse`/`run`/`mcp` —
  not a separately distributed binary or package.
- Standard input/output MUST carry only LSP protocol frames for the lifetime of
  the process once started. Human-readable logging, if any, MUST go to standard
  error, never standard input/output.
- The command MUST follow the same deterministic top-level dispatch, exit-code,
  and error-shape conventions as the other CLI modes for startup failures (for
  example invalid flags).
- `uffda lsp` and `uffda mcp` MUST be independently invokable and MUST NOT
  require one to be running for the other to function.

Postconditions:

- Nothing written to stdout/stdin by the server is ever something other than a
  well-formed LSP protocol message.

---
id: cli-language-server-010
title: uffda lsp lives as long as its stdio connection, with the release permissions
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#server-mode-and-invocation"
---

# Server Lifetime

## Requirement

Preconditions:

- `uffda lsp` runs with exactly the permissions the release binary is compiled
  with (`CLI_COMPILE_PERMISSION_FLAGS`).
- The client sends `initialize` with `processId` set to its own, live process.

Expected behavior:

- The server MUST keep running and answering requests for as long as standard
  input stays open, well past any interval a parent-process check would use
  (more than 3 seconds).
- The server MUST NOT signal or poll the client's process to decide whether to
  keep running.
- When standard input closes, the server MUST exit: with code 0 if the client
  sent `shutdown` first, and with code 1 otherwise.
- When the client sends `exit`, the server MUST exit with code 0 after a
  `shutdown` request, and with code 1 otherwise.

Postconditions:

- An editor that reports its process ID, as VS Code does, keeps one server
  running instead of restarting it every few seconds.

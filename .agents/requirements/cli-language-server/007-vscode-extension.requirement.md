---
id: cli-language-server-007
title: The VS Code extension registers uffda lsp for .uff and is packageable without per-language forks
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#vs-code-extension"
---

# VS Code Extension

## Requirement

Preconditions:

- The extension is installed in VS Code and `uffda` (with `lsp` support) is
  available on the host (bundled with the extension or resolved from `PATH`, per
  the extension's own packaging choice).

Expected behavior:

- The extension MUST register `uffda lsp` as the language server for `.uff`
  files as its first, dogfooding-target language contribution.
- The extension MUST launch `uffda lsp` as a child process communicating over
  stdio, per the transport contract (001), and MUST surface a clear, actionable
  error (not a silent failure) if the `uffda` binary cannot be located or fails
  to start.
- The extension MUST be structured so that a workspace whose `.uffda/lsp.jsonc`
  (002) declares additional languages gets those languages served by the same
  running server/extension instance, without requiring a separate, per-language
  extension package or fork. A future per-language thin wrapper extension MAY be
  built on top of this one but MUST NOT be required for a workspace to use the
  server against its own grammar.
- The extension MUST be packaged as a standard `.vsix` buildable through the
  normal VS Code extension packaging flow (`vsce package` or equivalent),
  installable both from a local `.vsix` file and, when published, from the
  Marketplace.
- The extension MUST NOT duplicate diagnostic/highlighting/hover/completion
  logic in extension (client-side) code; all such logic MUST come from the
  `uffda lsp` server responses, per LSP's client/server division of
  responsibility.

Postconditions:

- Opening a `.uff` file in a workspace with the extension installed yields live
  diagnostics and highlighting with no additional per-file configuration beyond
  the workspace's `.uffda/lsp.jsonc`.

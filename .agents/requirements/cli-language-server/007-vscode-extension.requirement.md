---
id: cli-language-server-007
title: The VS Code extension registers uffda lsp for .uff, registers uffda as an MCP server, resolves/downloads its binary automatically with a debug override, and is packageable without per-language forks
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#vs-code-extension"
---

# VS Code Extension

## Requirement

Preconditions:

- The extension is installed in VS Code. The host MAY or MAY NOT already have a
  `uffda` binary on `PATH`; the extension MUST work correctly in both cases (see
  binary acquisition below).

Expected behavior:

- The extension's source lives in this repository under `editors/vscode/`, as
  its own independently versioned npm package, isolated from `deno.jsonc`'s
  `fmt`/`lint`/`test`/publish tasks (which MUST exclude `editors/vscode/`) and
  built/tested via its own CI job. This is a deliberate, revisitable choice —
  splitting it into a separate repository later remains an acceptable future
  refinement if in-repo npm/Deno coexistence becomes cumbersome.
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
- The extension MUST also register `uffda` as an MCP server via VS Code's
  built-in MCP server registration mechanism (contributing an MCP server
  definition that launches `uffda mcp` over stdio, per
  [MCP server mode](../../specifications/languages/cli/mcp-server.spec.md)'s
  transport contract). Installing the extension MUST be sufficient to make the
  MCP tools available to the editor's AI/agent features, with no separate,
  manual MCP server configuration step required from the user.
- The MCP server registration MUST use the same `uffda` binary resolution the
  extension uses for `uffda lsp` (bundled binary or `PATH` resolution, whichever
  the extension's packaging chooses), so the two registrations never disagree
  about which `uffda` binary/version is in use.
- The extension MUST declare a minimum supported `uffda` version and, on
  activation, MUST resolve a usable `uffda` binary as follows, in order:
  1. If a `uffda` binary is found on `PATH` and its `uffda_version` (or
     equivalent version query) satisfies the minimum version, use it directly —
     no download.
  2. Otherwise, download the platform-matching compiled binary asset
     (`uffda-<version>-<target>[.exe]`) from the project's published GitHub
     Release artifacts (see `.github/workflows/release-binaries.yml`), verify it
     against its published `.sha256` checksum, and cache it in the extension's
     own persistent storage for reuse across sessions.
- The extension MUST NOT require the user to manually install `uffda` as the
  only way to make the extension work; automatic download (step 2 above) MUST be
  the fallback whenever a compatible `PATH` binary is absent.
- If both PATH resolution and the download fallback fail (for example, no
  network access and no compatible `PATH` binary), the extension MUST surface a
  clear, actionable error identifying the failure and MUST NOT silently disable
  itself without explanation.
- The extension MUST expose user-facing settings (for example
  `uffda.lsp.serverPath` and `uffda.lsp.serverArgs`, or an equivalent
  full-command override) that, when set, are used verbatim to launch the server
  process, completely bypassing PATH resolution, version checking, and download
  (steps above). This lets a contributor point the extension at a local source
  checkout (for example `deno run -A ./mod.ts lsp` or an in-progress build) to
  debug `uffda lsp` itself.
- When a server-path/command override is configured, the extension MUST still
  surface a clear, actionable error if the overridden command fails to start,
  rather than silently falling back to PATH resolution or download — overriding
  is explicit and MUST behave predictably for debugging.
- The MCP server registration (`uffda mcp`) SHOULD honor the same override
  settings where practical, so a contributor debugging a local `uffda` build
  gets consistent behavior across both the language server and MCP server
  registrations.

Postconditions:

- Opening a `.uff` file in a workspace with the extension installed yields live
  diagnostics and highlighting with no additional per-file configuration beyond
  the workspace's `.uffda/lsp.jsonc`.
- Installing the extension also makes `uffda`'s MCP tools available to the
  editor's agent features with no separate manual MCP configuration step.
- A user with no `uffda` installation on `PATH` still gets a working extension
  after installation, with no manual binary-installation step required.
- A contributor can point the extension at a locally built/source-run `uffda`
  via the override settings, without needing to modify or reinstall the
  extension itself.

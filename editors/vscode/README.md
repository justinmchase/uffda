# Uffda for VS Code

Language support for [Uffda](../../README.md) `.uff` grammars.

## Features

- **Diagnostics and language server integration.** Launches `uffda lsp`
  (see `.agents/specifications/languages/cli/language-server.spec.md`) as a
  child process over stdio and surfaces live parse diagnostics for open
  `.uff` files, using the workspace's `.uffda/lsp.jsonc` if present.
- **MCP server registration.** Registers `uffda mcp` as an MCP server via VS
  Code's built-in MCP integration, with no separate configuration step
  required — the editor's agent/chat features immediately get Uffda's MCP
  tools once the extension is installed.
- **Automatic binary acquisition.** If a compatible `uffda` binary is not
  already on `PATH`, the extension downloads the platform-matching compiled
  binary from the project's GitHub Releases, verifies its checksum, and
  caches it for reuse.

## Settings

| Setting | Description |
| --- | --- |
| `uffda.lsp.serverPath` | Overrides the `uffda` executable used for both the language server and the MCP server, bypassing `PATH` resolution and download entirely. Useful for pointing the extension at a local source checkout, e.g. `deno`. |
| `uffda.lsp.serverArgs` | Arguments passed to `uffda.lsp.serverPath` when launching the language server (default: `["lsp"]`). For example: `["run", "-A", "./src/cli/main.ts", "lsp"]`. |
| `uffda.mcp.serverArgs` | Arguments passed to `uffda.lsp.serverPath` when launching the MCP server (default: `["mcp"]`). For example: `["run", "-A", "./src/cli/main.ts", "mcp"]`. |

When `uffda.lsp.serverPath` is unset, the extension resolves a `uffda`
binary automatically: prefer a compatible version on `PATH`, otherwise
download and cache one. If neither succeeds, the extension surfaces a clear
error instead of silently disabling itself.

## Design notes

`language-configuration.json` and the single `contributes.languages` entry in
`package.json` are `.uff`-specific fallback scaffolding when the language
server does not yet expose `[Language]` metadata. On activation the extension
requests `uffda/languageMetadata` and:

- applies editor configuration with `vscode.languages.setLanguageConfiguration()`
- maps `[Language].ext` → language id and assigns ids at runtime with
  `vscode.languages.setTextDocumentLanguage()` for workspace-declared
  languages (so additional languages do not need a second static
  `contributes.languages` entry)

Workspace `.uffda/lsp.jsonc` entries may omit `extensions` when the grammar's
`[Language]` metadata supplies `ext` (JSON still wins when present).

See the "Language configuration" and "VS Code extension" sections of
[`language-server.spec.md`](../../.agents/specifications/languages/cli/language-server.spec.md)
and requirements
[`002-language-configuration`](../../.agents/requirements/cli-language-server/002-language-configuration.requirement.md)/[`007-vscode-extension`](../../.agents/requirements/cli-language-server/007-vscode-extension.requirement.md).

## Development

This extension lives in this repository under `editors/vscode/` as its own
independently versioned npm package — it is excluded from the root
`deno.jsonc` `fmt`/`lint`/`test`/`publish` tasks and built/tested through its
own CI job.

```sh
cd editors/vscode
npm install
npm run compile      # or: npm run watch
```

Press F5 in VS Code (with this directory open, or via the repo's
`.vscode/launch.json`) to launch an Extension Development Host, or package a
`.vsix` locally with:

```sh
npm run package
```

See
[`.agents/requirements/cli-language-server/007-vscode-extension.requirement.md`](../../.agents/requirements/cli-language-server/007-vscode-extension.requirement.md)
for the full behavioral contract.

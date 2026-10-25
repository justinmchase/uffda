# Uffda for VS Code

Language support for [Uffda](../../README.md) `.uff` grammars.

## Features

- **Diagnostics and language server integration.** Launches `uffda lsp`
  (see `.agents/specifications/languages/cli/language-server.spec.md`) as a
  child process over stdio and surfaces live parse diagnostics for open
  `.uff` files and for the languages the workspace's `uffda.jsonc` lists.
- **MCP server registration.** Registers `uffda mcp` as an MCP server via VS
  Code's built-in MCP integration, with no separate configuration step
  required — the editor's agent/chat features immediately get Uffda's MCP
  tools once the extension is installed.

### Duplicate `uffda` / `Uffda` MCP entries (client-side)

The server registers each tool once. Seeing both `uffda` and `Uffda` (or two
identical Uffda MCP servers) is almost always a **client configuration** issue,
not a duplicate server-side registration:

1. The VS Code/Cursor extension registers an MCP provider id `uffda` whose
   displayed definition label is `Uffda`.
2. A manual `mcp.json` / Cursor MCP entry that also launches another `uffda mcp`
   (for example a second path or an old Deno CLI) creates a second server.

**Fix on the client:** keep only one registration, and point it at **`uffda`**
(the release Rust CLI). Do not also run a second MCP entry. After rebuilding
Rust, reinstall/copy the new binary as `uffda` and restart the MCP connection.
- **Automatic binary acquisition.** If a compatible binary is not already on
  `PATH`, the extension downloads the platform-matching compiled binary from
  the project's GitHub Releases, verifies its checksum, and caches it for reuse.

## Settings

| Setting | Description |
| --- | --- |
| `uffda.lsp.serverPath` | Overrides the executable used for both the language server and the MCP server, bypassing `PATH` resolution and download entirely. Point this at **`uffda`** (or a freshly built `target/release/uffda`). Resource-scoped: works in folder `.vscode/settings.json` and multi-root workspaces. |
| `uffda.lsp.serverArgs` | Arguments passed to `uffda.lsp.serverPath` when launching the language server (default: `["lsp"]`). |
| `uffda.mcp.serverArgs` | Arguments passed to `uffda.lsp.serverPath` when launching the MCP server (default: `["mcp"]`). |

When `uffda.lsp.serverPath` is unset, the extension resolves a binary
automatically: use **`uffda`** on `PATH` when its version satisfies the
minimum, otherwise download and cache a release binary. If neither succeeds,
the extension surfaces a clear error instead of silently disabling itself.

`uffda.lsp.serverPath` overrides PATH resolution entirely:

| Value | Effect |
| --- | --- |
| unset / `""` | Prefer `uffda` on PATH, else download |
| `uffda` | Bare name — run from PATH |
| `target/release/uffda` | Relative to the uffda workspace folder (local build) |
| absolute path | Used verbatim |

Recommended for this checkout (local Rust build):

```json
{
  "uffda.lsp.serverPath": "target/release/uffda",
  "uffda.lsp.serverArgs": ["lsp"],
  "uffda.mcp.serverArgs": ["mcp"]
}
```

Installed release binary instead:

```json
{
  "uffda.lsp.serverPath": "uffda"
}
```

Do **not** set `serverPath` to `deno` or pass `run -A …/src/cli/main.ts`.

## Design notes

`language-configuration.json` declares no comments and no brackets, so VS Code
adds no bracket matching, bracket colors, auto-closing, or auto-surrounding.
All coloring comes from the language server's semantic tokens.

Ctrl+/ (Cmd+/ on Mac) runs `Uffda: Toggle Line Comment`, which asks the
language server to toggle comments on the selected lines with the rule the
grammar names with `[ToggleComment]`. The Edit menu's built-in toggle does
nothing in Uffda files.

On activation the extension requests `uffda/languageMetadata` for the
extensions every language claims in its `[Language]` metadata, and gives
matching files the `uffda` language id with
`vscode.languages.setTextDocumentLanguage()`. VS Code cannot register language
ids at runtime, so every grammar's files share `uffda` (the status bar shows
"Uffda") and the language server picks the grammar from the file's extension.

The language client sends workspace folders on `initialize` (and folder change
notifications afterward). It also passes `initializationOptions.cacheDir`
pointing at the extension's persistent storage so JSR package downloads do not
depend on process cwd or the user's home cache. Relative `.uff` imports stay
file-relative; `uffda.jsonc` is still discovered from the document path within
its workspace folder.

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

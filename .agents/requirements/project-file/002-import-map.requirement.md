---
id: project-file-002
title: Every resolver the tools build takes the project file's imports as its import map
spec_ref: ".agents/specifications/modules.spec.md#import-maps"
---

# Import Map

## Requirement

Preconditions:

- A command, the language server, or an MCP session resolves module imports.

Expected behavior:

- The project file MUST be loaded before any parse or resolution: the file
  `--config <path>` (CLI `compile`, `exec`, `fmt`, `run`) or `config` (MCP
  `uffda_compile`, `uffda_session_open`) names, resolved against the working
  directory, else the nearest `uffda.jsonc` at or above it. The language server
  uses the nearest one at or above its workspace root.
- `--config` on `match` or `parse`, or without a value, MUST be a usage failure.
- An invalid project file, or a missing one `--config` names, MUST fail the CLI
  command with a configuration failure (exit code 3), `uffda_compile` with a
  `CLI_COMPILE_INVALID_PROJECT` failure, and `uffda_session_open` with
  `MCP_SESSION_OPEN_INVALID_PROJECT`. The language server logs it and resolves
  with no import map.
- The project's `imports` MUST be the `imports` option of every `Resolver` the
  command builds (`ResolverOptions.imports`); without a project the map is
  empty.
- `Resolver` MUST resolve a module name through `unfurlSpecifier`
  (`src/runtime/resolvers/import_map.ts`): `@acme/kv/tokens` with `@acme/kv`
  mapped to `jsr:@acme/kv@^1.2.0` resolves to `jsr:@acme/kv@^1.2.0/tokens`.
- A module name no alias covers MUST fail with the message
  `"<specifier>" is not a module name the project file's \`imports\`
  declares`,
  and an import chain frame naming the import with no`resolvedUrl`.
- A `jsr:` module that no seeded declaration supplies MUST fail with
  `Unable to load <url>: loading modules from packages is not supported yet`.
- Relative and `jsr:` specifiers MUST resolve as written.

Postconditions:

- An import means the same module in `compile`, `run`, `exec`, the language
  server, and MCP sessions of one project.
- Tests: `src/runtime/resolvers/import_map.test.ts`,
  `src/runtime/resolve.test.ts` (RESOLVE11), `src/cli/command_project.test.ts`,
  `src/cli/contract.test.ts`, `src/cli/main.test.ts`,
  `src/cli/mcp.session.test.ts`, `src/cli/mcp.session_tools.test.ts`,
  `src/cli/lsp.test.ts`.

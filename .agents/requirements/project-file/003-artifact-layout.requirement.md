---
id: project-file-003
title: Every tool writes and reads compiled artifacts through the project's artifact layout
spec_ref: ".agents/specifications/languages/project-file.spec.md#output-directory"
---

# Artifact Layout

## Requirement

Preconditions:

- A command, the language server, or an MCP session compiles `.uff` sources or
  resolves `.uff` imports, with the project file found as in
  [import map](./002-import-map.requirement.md).

Expected behavior:

- `outDir` MUST be a `./` path inside the project; any other value (`"bin"`,
  `"../bin"`, `"/bin"`, a non-string) is a problem. It defaults to `./bin`.
- The artifact layout MUST be the project's root and `outDir`, or, without a
  project, the working directory (the language server: its workspace root) and
  `./bin` (`ArtifactLayout` in `src/runtime/resolvers/artifact_path.ts`).
- `<root>/<path>.uff` MUST compile to both `<outDir>/ast/<path>.uff.ast` (data
  codec) and `<outDir>/ast/<path>.uff.ast.json` (JSON). A resolver given that
  layout (`ResolverOptions.artifacts`) MUST prefer the `.uff.ast.json` file when
  it exists and otherwise read `.uff.ast`. Nothing is written next to a source.
- `uffda compile`, MCP `uffda_compile`, `run`, `exec`, MCP sessions (their
  compile-on-demand included), and the language server MUST all use the layout.
  MCP tools take no output or artifact directory argument.
- A source outside the root MUST fail: `compile` with a
  `CLI_COMPILE_SOURCE_OUTSIDE_ROOT` unit failure, a resolver with a
  module-resolution error, and compile-on-demand with a load failure, each
  naming the module and the root.

Postconditions:

- A module's artifacts are found from its project file alone, so a package's
  consumers can locate them.
- Tests: `rust/src/resolver/ported_tests.rs`, `rust/src/cli/command_ports.rs`,
  `rust/src/cli/surface_ports.rs`, `rust/src/mcp/ported_tests.rs`,
  `rust/src/lsp/ported_tests.rs`.

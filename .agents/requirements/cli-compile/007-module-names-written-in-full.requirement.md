---
id: cli-compile-007
title: Compile writes every import's module name out in full through the import map
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# Module Names Written in Full

## Requirement

Preconditions:

- `uffda compile` (or MCP `uffda_compile`, or compile-on-demand of a session's
  imports) compiles a unit whose imports may name module names, with the import
  map of the project it uses (see
  [import map](../project-file/002-import-map.requirement.md)).

Expected behavior:

- Each import's `moduleUrl` in the written artifact MUST be the specifier
  `unfurlSpecifier` gives: a module name becomes its full `jsr:` specifier;
  relative and `jsr:` specifiers stay as written.
- A unit importing a module name the import map does not declare MUST fail with
  one `CLI_COMPILE_UNDECLARED_MODULE_NAME` diagnostic per such import, each
  located at the import's specifier (the text between its quotes), and MUST NOT
  write an artifact.
- The rewrite MUST happen when the artifact is written, as part of compile; no
  step may rewrite an artifact afterwards.

Postconditions:

- Every import in an artifact names a relative path or a full `jsr:` specifier.
- Tests: `src/cli/compile.test.ts`, `src/cli/main.test.ts`,
  `src/cli/mcp.static_tools.test.ts`, `src/cli/ensure_import_artifacts.test.ts`.

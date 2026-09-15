---
id: cli-language-server-006
title: Hover, go-to-definition, and completions are read-only introspection over resolved module state
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#hover-navigation-and-completions"
---

# Hover, Navigation, and Completions

## Requirement

Preconditions:

- A document has been opened and successfully resolved (at least partially) as
  part of its configured language's module graph.

Expected behavior:

- `textDocument/hover` MUST report structural information (kind, parameters,
  attributes/metadata) about the rule/func/decorator/expression node at the
  requested position, using the same descriptive information the MCP server's
  `describe`-style introspection already exposes (see
  [MCP server mode](../../specifications/languages/cli/mcp-server.spec.md)),
  rather than a separately maintained documentation source.
- `textDocument/definition` MUST resolve a reference to a rule, func, or
  decorator to its declaring location within the workspace's resolved module
  graph, including across `.uff` import boundaries. A reference the server
  cannot resolve MUST return no location (an empty result), never a location
  chosen by heuristic/best-effort guessing.
- `textDocument/completion` MUST offer in-scope rule/func/decorator names at the
  requested position, and, where statically determinable from the expression
  grammar's structure, expression-level completions (for example parameter names
  in scope).
- None of hover, go-to-definition, or completion requests MUST mutate any
  document's parse/resolution state, retained match results, or diagnostics as a
  side effect of being answered — they are read-only queries over already
  resolved state (003/004).
- These capabilities MUST degrade gracefully (returning empty/no results rather
  than erroring the request) for a document that currently has unresolved parse
  or compile failures, at least for the regions unaffected by those failures.

Postconditions:

- Every hover/definition/completion response is fully explainable by the
  document's (and its imports') current resolved state at the moment of the
  request.

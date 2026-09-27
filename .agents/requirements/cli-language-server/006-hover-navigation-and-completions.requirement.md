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
  rather than a separately maintained documentation source. When the
  declaration's source can be located (the same lookup go-to-definition uses)
  the hover MUST show that source as authored (attributes included, long
  declarations truncated), plus any decorator-computed metadata not visible in
  it (for example `[Keyword]` → `{ role: "keyword" }`); otherwise it MUST
  summarize the pattern, parameters, and attributes. It MUST NOT repeat
  attribute values as a separate metadata dump.
- Hover MUST resolve a name in the same order references resolve it: a local
  binding first, then a declared rule/func/decorator, then (only where the
  reference may name a func) a runtime global.
  - Local bindings MUST be found from the document's parse tree. A captured
    variable (`name:pattern`, including func and lambda parameters) is visible
    to expression references inside the enclosing `[Declaration]` or lambda that
    binds it, and the innermost binding wins. A rule parameter is visible to
    pattern references in its rule. At a binding site (not a `[NameReference]`)
    either kind applies. A variable hover MUST show its binding as authored; a
    parameter hover MUST name its rule.
  - A runtime global hover MUST show the global's signature and description from
    the metadata it carries (see
    [runtime value metadata](../../specifications/runtime/value-metadata.spec.md)).
- `textDocument/definition` MUST resolve a reference to a rule, func, or
  decorator to its declaring location within the workspace's resolved module
  graph, including across `.uff` import boundaries. A reference the server
  cannot resolve MUST return no location (an empty result), never a location
  chosen by heuristic/best-effort guessing.
- Hover and go-to-definition MUST identify the name under the cursor from the
  document's parse tree (an `identifier`-role token span); with no parse tree
  they MUST return no result rather than scanning the text. Definition MUST
  locate declarations by `[Declaration]` metadata.
- `textDocument/completion` MUST derive what it offers from the completion
  contexts the document's grammar produces for the text before the cursor (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#completion-contexts)),
  never from text patterns:
  - in a `[ModulePath]`, it MUST offer the importable entries relative to the
    document: modules with the path's declared extensions (`.uff` for the `.uff`
    grammar) and directories in the directory the typed relative path (`./`,
    `../`) names, excluding the document itself and hidden entries; an empty
    path offers `./` and `../`;
  - in an `[ImportedName]`, it MUST offer the names the module named by the
    enclosing import's `[ModulePath]` exports, excluding names that import
    already binds. Reading an unresolved module's exports MUST NOT write
    artifacts or change session state;
  - in a `[NameReference]`, it MUST offer the in-scope declarations of the kinds
    it names (rules in a pattern, funcs in an expression, decorators in an
    attribute, any kind in an export list), and, where statically determinable
    from the expression grammar's structure, expression-level completions (for
    example parameter names in scope).
- A position no completion context reaches MUST return no items, whether or not
  the request was triggered by a trigger character.
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

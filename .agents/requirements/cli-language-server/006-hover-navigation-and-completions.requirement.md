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
    binds it, and the innermost binding wins. A rule parameter (a `[Parameter]`
    production) is visible to pattern references in its rule. Only the accepted
    parse binds: a would-be binding inside an attempt the parse rejected binds
    nothing, except the attempt still being typed at the cursor (completion's
    prefix parse), whose bindings so far count. At a binding site (not a
    `[NameReference]`) either kind applies. A variable hover MUST show its
    binding as authored; a parameter hover MUST name its rule.
  - A declaration's `[Documentation]` (see
    [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#vocabulary))
    MUST lead its hover, its parameter descriptions MUST follow, and a local
    binding that is a documented parameter of its declaration MUST show that
    parameter's description. Completion items MUST carry the description.
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
- `textDocument/references` MUST return every occurrence (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#declarations-references-and-imports))
  of the symbol under the cursor: a local binding's within its document; a
  declaration's in its module and every workspace `.uff` module importing it; a
  runtime global's wherever it is referenced. Declaring occurrences MUST be left
  out unless the request includes the declaration.
- `textDocument/prepareRename` MUST return the range of the name under the
  cursor, no result when there is none, or an error explaining why its symbol
  cannot be renamed. `textDocument/rename` MUST return a workspace edit
  replacing every occurrence (import lists and export lists included), or an
  error when the rename is refused (a runtime global; a declaration outside the
  workspace; a new name already occurring in an edited document; a new name the
  grammar does not read back as that name). Neither MUST write files.
- `textDocument/completion` MUST derive what it offers from the completion
  contexts the document's grammar produces for the text before the cursor,
  parsed as an open input so an empty position after a repetition (for example a
  call's next argument) has a context (see
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
  - in a `[NameReference]`, it MUST offer the local bindings visible at the
    cursor that the reference may name (as hover finds them: captured variables
    where a func may be named, rule parameters where a rule may be named),
    innermost first, then the in-scope declarations of the kinds it names (rules
    in a pattern, funcs in an expression, decorators in an attribute, any kind
    in an export list). A declaration a local binding shadows MUST NOT be
    offered. Where the reference names funcs, it MUST then offer the runtime
    globals (documented as hover describes them) that no local binding or
    declaration shadows; it MUST NOT offer globals where funcs are not named
    explicitly (e.g. an export list).
- A position no completion context reaches MUST return no items, whether or not
  the request was triggered by a trigger character.
- None of hover, go-to-definition, references, rename, or completion requests
  MUST mutate any document's parse/resolution state, retained match results, or
  diagnostics as a side effect of being answered — they are read-only queries
  over already resolved state (003/004).
- These capabilities MUST degrade gracefully (returning empty/no results rather
  than erroring the request) for a document that currently has unresolved parse
  or compile failures, at least for the regions unaffected by those failures.

Postconditions:

- Every hover/definition/completion response is fully explainable by the
  document's (and its imports') current resolved state at the moment of the
  request.

# Language server mode

This chapter defines the contract for `uffda lsp`, a Language Server Protocol
(LSP) mode of the `uffda` CLI that drives real-time, edit-driven editor tooling
(diagnostics, highlighting, hover, and navigation) from a live, incrementally
re-parseable runtime, plus the companion VS Code extension that consumes it.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Logical purpose

Editor tooling — live diagnostics as a user types, syntax highlighting, hover
information, and navigation — is the concrete, higher-value use case that
motivated
[runtime incremental re-parsing](../../runtime/incremental-parsing.spec.md) (see
that chapter's "Logical purpose"). That capability is only useful in practice
once something actually drives it from an editor. `uffda lsp` is that consumer:
an LSP server mode of the existing `uffda` CLI binary, backed by the same
deterministic parse/compile/match pipeline the batch CLI and
[MCP server mode](./mcp-server.spec.md) already use, so a Uffda-authored
language (starting with Uffda's own `.uff` language) gets standard editor
tooling without a bespoke, hand-maintained classifier or highlighter.

This chapter defines the LSP server's contract and the VS Code extension that is
its first client. It composes the existing runtime and CLI contracts; it does
not introduce a parallel parsing or compilation pathway.

## Relationship to MCP server mode

- `uffda lsp` and `uffda mcp` (see [MCP server mode](./mcp-server.spec.md)) are
  separate CLI modes serving separate protocols and separate consumers: LSP
  serves editors via the standardized Language Server Protocol, MCP serves
  agents via the Model Context Protocol. Neither MUST be implemented in terms of
  the other.
- Both modes MUST be built on the same underlying parse/compile/resolve pipeline
  and MUST NOT diverge in diagnostic content or parse outcome for equivalent
  input.

## Server mode and invocation

- `uffda lsp` MUST start a Language Server Protocol server communicating over
  standard input/output, consistent with how `uffda mcp` communicates over stdio
  (see [transport contract](./mcp-server.spec.md#transport-contract)).
- Once started, standard input/output MUST carry only LSP protocol traffic;
  diagnostics, logs, or other incidental output MUST NOT be interleaved on these
  streams.
- `uffda lsp` MUST be a mode of the existing `uffda` CLI binary, alongside
  `compile`/`exec`/`match`/`parse`/`run`/`mcp`, not a separately distributed
  binary or package.

## Language configuration

- The server MUST support serving more than one Uffda-authored language within a
  single workspace, each potentially backed by a different compiled grammar.
- A workspace MUST declare, via a workspace configuration file, which file
  types/extensions map to which compiled grammar module and entry rule the
  server should load for that language. The server MUST NOT infer this mapping
  solely from file extension conventions or auto-discovery.
- The configuration file's location and shape are a requirement-level concern
  (see the language-server requirements under `.agents/requirements/`); this
  chapter only requires that such a file exist and be the authoritative source
  for language-to-grammar mapping.
- `.uff` itself (Uffda's own grammar language) MUST be configurable the same way
  as any user-authored language — the server MUST NOT hard-code `.uff` handling
  through a path unavailable to other languages.
- Each extension MUST belong to at most one language, so every document belongs
  to exactly one language or none. A workspace language claiming an extension of
  the built-in `.uff` language MUST take that extension over, since an explicit
  workspace setting wins. An extension claimed by two or more workspace
  languages (directly, or filled in from `[Language]` metadata) is a
  configuration error: it MUST be reported naming the extension and the
  languages, and none of them MUST serve it, while every other extension stays
  served.
- This chapter does not yet require it, but implementations SHOULD avoid designs
  that would need to be undone to support it later: a grammar module MAY
  eventually self-declare its own file extension(s) and other editor-facing
  configuration (see "VS Code extension" below) via decorator-derived metadata
  on its entry rule — for example a decorator that takes one object-literal
  argument and an application site like
  `[Language { ext: ".uff", name: "Uffda" }]` (or a narrower positional form
  such as `decorator Language<ext:string> = { kind: "language", ext };` applied
  as `[Language ".uff"]`), queryable the same way `[Token]`/`[Keyword]` metadata
  already is — see [rule metadata](../../runtime/rule-metadata.spec.md) — rather
  than requiring every consumer (the workspace configuration file, an editor
  extension) to separately hard-code per-language facts the grammar already
  knows about itself. A per-language config entry remains the near-term source
  of truth and, when present, MUST take precedence over any future self-declared
  metadata (an explicit workspace override always wins).

## Document synchronization and incremental re-parsing

- The server MUST support `textDocument/didOpen`, `textDocument/didChange`, and
  `textDocument/didClose` for each configured language.
- On `didChange`, the server MUST feed the reported edit into the runtime using
  [incremental re-parsing](../../runtime/incremental-parsing.spec.md) wherever
  the edit's affected region allows reuse of prior parse state, and MUST fall
  back to a full re-parse whenever reuse cannot be established, per that
  chapter's conservative-fallback rule. Either path MUST be observably
  equivalent in outcome; incremental reuse MUST remain a performance
  optimization only.
- For a multi-stage pipeline (see
  [multi-stage pipelines](../../runtime/incremental-parsing.spec.md#multi-stage-pipelines)),
  the server MUST evaluate and expose each pipeline stage's affected region and
  diagnostics independently, rather than collapsing every stage into a single
  outermost result. A downstream stage's diagnostics MUST be attributable back
  to source-facing positions before being published to the editor.

## Diagnostics

- The server MUST publish `textDocument/publishDiagnostics` reflecting parse,
  compile, and resolution failures for the affected document, using the same
  underlying failure information the batch CLI and MCP server already surface
  (for example `getRightmostFailure`), translated into LSP diagnostic ranges.
- Diagnostics MUST be republished after every document change that could alter
  them, including changes whose affected region, under incremental re-parsing,
  turned out not to actually change any diagnostic (an edit that leaves
  diagnostics unchanged MUST still result in a well-defined, not stale,
  diagnostic set).
- The server MUST publish every parse diagnostic (see
  [error recovery](../../runtime/error-recovery.spec.md#diagnostics)): one per
  recovery, ranged over the source it skipped, and the parse failure, if any. A
  document that parsed only by recovering MUST NOT be compiled or resolved;
  highlighting, symbols, and other features derived from the parse MUST read the
  recovered parse.
- Diagnostics from a downstream pipeline stage MUST be reported at the stage's
  own responsible source-facing range, not merged into or hidden behind an
  upstream stage's diagnostics.
- A resolution failure caused by one of the document's imports (a missing
  module, a dependency that fails to compile, or a failure deeper in that
  import's own import graph) MUST be reported at the source range of that import
  declaration in the document, not the whole document. When the failure has a
  known location inside a dependency's own source, the diagnostic SHOULD link to
  it (LSP `relatedInformation`). A whole-document range is only the fallback for
  failures that cannot be attributed to a source range.

## Syntax highlighting

- The server MUST support `textDocument/semanticTokens` for syntax highlighting,
  deriving token classification from the grammar's own delivered parse tree and
  its `[Highlight]`/`[Keyword]` rule metadata (see
  [editor metadata](./editor-metadata.spec.md#highlighting)), rather than a
  separately hand-maintained TextMate-style grammar or a map of rule names.
- Highlighting MUST be kept current under incremental re-parsing using the same
  document-synchronization contract as diagnostics.

## Hover, navigation, and completions

- The server MUST support `textDocument/hover`, reporting structural information
  about the rule/func/decorator/expression at the requested position, using the
  same descriptive information the MCP server's introspection tools already
  expose (see [introspection tools](./mcp-server.spec.md)). Local bindings
  (captured variables and parameters) and runtime globals MUST be describable
  too: locals from the document's parse tree, globals from the metadata they
  carry (see [runtime value metadata](../../runtime/value-metadata.spec.md)).
- The server MUST support go-to-definition (`textDocument/definition`) for
  references to rules, funcs, and decorators, resolving to the declaration's
  source location within the workspace's resolved module graph, and for local
  bindings, resolving to where they are bound (a rule parameter, or a variable's
  binding site). A local binding takes precedence over a declaration of the same
  name, as it does in reference resolution.
- The server MUST support find-references (`textDocument/references`) and rename
  (`textDocument/prepareRename`, `textDocument/rename`) for local bindings,
  declarations, and (references only) runtime globals, across every `.uff`
  document in the workspace: a declaration's occurrences are in its module and
  in the modules importing it by a path resolving to that module (open buffers
  win over files on disk). Rename returns a workspace edit and never writes
  files; it MUST be refused, with a reason, rather than produce an edit that
  changes what any name denotes or that the grammar would not read back as the
  same name (see
  [editor metadata](./editor-metadata.spec.md#declarations-references-and-imports)).
- The server MUST support `textDocument/completion`, offering in-scope
  rule/func/decorator names and, where staticly determinable, expression-level
  completions. What is offered at a position MUST be determined by the
  completion contexts the document's grammar derives there (see
  [editor metadata](./editor-metadata.spec.md#completion-contexts)): importable
  modules in a module path, the imported module's exports in an imported name,
  and declarations of the referenced kinds in a name reference. The server MUST
  NOT recognize any language's syntax (imports, identifiers) by text patterns.
- Declarations, names under the cursor, and import sub-ranges MUST likewise be
  located through editor metadata, not rule names.
- These capabilities MUST be read-only with respect to runtime/session state:
  none of them MUST mutate a document's parse state as a side effect of being
  queried.

## Formatting

- The server MUST advertise `documentFormattingProvider` and support
  `textDocument/formatting` for each configured language, formatting a document
  with the formatter its language's entry rule names (see
  [editor metadata](./editor-metadata.spec.md#formatting)) exactly as
  [`uffda fmt`](./formatting.spec.md) formats the same text.
- The response MUST be one edit replacing the whole document with its formatted
  text, or no edits when the text is already formatted.
- The server MUST return no edits when the document's current text did not parse
  cleanly (the diagnostics already report why) or its language has no
  `[Formatter]`. Formatting options sent by the client (tab size, spaces) MUST
  NOT change the result: the format belongs to the language.
- Formatting MUST be read-only with respect to the document's parse state.

## Comment toggling

- The server MUST support a custom `uffda/toggleComment` request, with params
  `{ textDocument: { uri }, range }`, and advertise it as
  `experimental.uffdaToggleComment`. It toggles comments on the whole lines
  `range` touches with the rule the document's language names with
  `[ToggleComment]` (see
  [editor metadata](./editor-metadata.spec.md#comment-toggling)).
- A range ending at the start of a later line MUST leave that line out.
- The response MUST be one edit replacing those lines (without the last line's
  line ending) with the rule's text, or no edits when the language has no
  `[ToggleComment]`, the rule fails, or the text would not change.
- Toggling works on the document's current text, not its parse, and MUST be
  read-only with respect to the document's parse state.

## VS Code extension

- A VS Code extension MUST register `uffda lsp` as the language server for
  `.uff` (Uffda's own grammar language) as the first, dogfooding target.
- The extension's source lives in this repository, under `editors/vscode/`, as
  its own independently versioned npm package (own `package.json`,
  `tsconfig.json`, and build/package tooling), rather than in a separate
  repository or folded into the Deno workspace's own `deno.jsonc`. This keeps
  the extension's version/compatibility requirements on `uffda` easy to keep in
  lockstep with this repo's own releases, while its npm-based toolchain stays
  isolated from `deno.jsonc`'s `fmt`/`lint`/`test`/publish tasks (which MUST
  exclude `editors/vscode/`) and gets its own CI job rather than being folded
  into the Deno `Checks` job. This placement is a deliberate, revisitable
  choice, not a permanent commitment — splitting the extension into its own
  repository remains an acceptable future refinement if the in-repo npm/Deno
  coexistence becomes cumbersome to maintain.
- The extension MUST be structured so that pointing it at a different
  workspace's language configuration (see "Language configuration" above) is
  sufficient to serve a user-authored language, without requiring a per-language
  fork of the extension itself. Packaging a thin, per-language wrapper extension
  is an acceptable future refinement but MUST NOT be required for a workspace to
  use the server against its own grammar.
- The extension MUST be shippable through the standard VS Code extension
  packaging/publishing flow (a `.vsix` package suitable for the Marketplace or
  manual installation).
- The extension MUST also register `uffda` as an MCP server (see
  [MCP server mode](mcp-server.spec.md)) using VS Code's built-in MCP
  integration, so that installing the extension is sufficient to make both the
  language server and the MCP tools available in the editor, with no separate
  manual MCP configuration step.
- The extension MUST resolve a working `uffda` binary automatically: it MUST
  prefer a `uffda` already on `PATH` when that binary satisfies the extension's
  minimum supported `uffda` version, and otherwise MUST download the matching
  platform binary from the project's published GitHub Release artifacts, caching
  it in the extension's own storage for reuse. Requiring the user to manually
  install `uffda` before the extension works MUST NOT be the only supported
  path.
- The extension's compatibility requirement on `uffda` MUST be expressed as a
  minimum version (not an exact pin), so that a newer, backward-compatible
  `uffda` already on `PATH` is accepted without triggering a redundant download.
- The extension MUST expose user-configurable settings to override both the
  server executable path and the full launch command/arguments used to start
  `uffda lsp`, bypassing automatic resolution/download entirely when set. This
  is intended for developing and debugging `uffda` itself (for example running
  the LSP mode from a local source checkout via `deno run` instead of a released
  binary), not for ordinary end-user use.
- The `uffda` language configuration MUST declare no comments and no brackets:
  explicit empty `brackets`, `colorizedBracketPairs`, `autoClosingPairs`, and
  `surroundingPairs`, so VS Code does not fall back to defaults. VS Code's own
  bracket handling cannot tell a bracket is inside a comment or string without a
  TextMate grammar; all coloring, including comments and punctuation, comes from
  the grammar's semantic tokens (`[Highlight]` metadata). Auto-closing and
  auto-surrounding pairs are deliberately not supported: typing `(` inserts only
  `(`.
- Comment toggling MUST come from the grammar: the extension contributes a
  `uffda.toggleLineComment` command bound to Ctrl+/ (Cmd+/ on Mac) when
  `editorTextFocus && editorLangId == uffda`. It sends the lines each selection
  touches to the server's [comment toggling](#comment-toggling) request
  (selections sharing or adjoining a line go together) and applies the returned
  edits. Only the shortcut is replaced: the Edit menu and Command Palette
  entries for VS Code's built-in toggle do nothing in Uffda files.
- Adding a second served language MUST NOT require a second hand-authored
  `language-configuration.json` or a second static `contributes.languages`
  entry. The extension assigns a language id to configured file extensions at
  runtime (via `vscode.languages.setTextDocumentLanguage()`, driven by the
  server's `uffda/languageMetadata` request).

## Performance intent

- Keystroke-to-diagnostics and keystroke-to-highlighting latency SHOULD track
  the size of an edit's affected region (per
  [incremental re-parsing](../../runtime/incremental-parsing.spec.md)'s
  performance intent), not the size of the full document, for large files.
- The server MAY fall back to full-document re-analysis cost in the worst case
  (per that chapter's fallback rule); it MUST remain correct in that case, only
  losing the performance benefit.

## Composition intent

- The language server SHOULD compose the same parse/compile/resolve pathways the
  batch CLI and MCP server already use rather than introducing an alternate
  implementation of any of them.
- The language server MAY reuse MCP `RuntimeSession`-shaped state internally,
  but this chapter does not require the two servers to share a process, a
  session model, or a wire protocol — only the underlying deterministic
  compiler/runtime pathways.
- When resolving `.uff` imports from open documents, the server MUST use the
  session/runtime artifact root (default `.uffda`) with compile-on-demand into
  that root — the same contract as
  [MCP session load](./mcp-server.spec.md#session-lifecycle-tools) — and MUST
  NOT assume workspace `./bin` or introduce an LSP-config `artifactRoot`.

## Status

`uffda lsp`'s server mode/invocation, language configuration, document
synchronization/incremental re-parsing, diagnostics, and full-document
semantic-token highlighting (see requirements 001-005 in
`.agents/requirements/cli-language-server/`) are implemented, `.uff`-only, over
stdio. Every piece of syntax knowledge the editor tooling uses comes from the
[editor metadata](./editor-metadata.spec.md) the `.uff` grammar applies to its
own rules (`src/lang/editor/editor.uff`): classification reads `[Highlight]`
roles plus `[Keyword]` (`src/cli/highlight.ts`), refining names into pattern
references (`type`), invoked functions (`function`), other expression references
(`variable`), and member names (`property`); the server then colors each
`variable` reference by what the session resolves it to (rules as `type`, funcs
and globals as `function`, local bindings staying `variable`;
`src/cli/lsp.reference_roles.ts`). Import-caused resolution failures are ranged
on the failing root import's `[ModulePath]` or `[ImportedName]` (via the
resolver's `importChain` and the session's retained parse tree), with the
dependency's own failure position as `relatedInformation` when known. A parse
failure on an incomplete line is anchored right after that line's last token; a
declaration the module grammar recovers from (for example an import missing its
names) is instead ranged over the skipped declaration. Document operations
(open/change/close and every query) run through a per-document queue in
`LspDocumentManager`, since the LSP connection does not await async notification
handlers. Hover (`textDocument/hover`) and go-to-definition
(`textDocument/definition`, both part of requirement 006) are implemented for
`.uff`: hover resolves the identifier under the cursor as a local binding (from
the parse tree), then through `RuntimeSession.describe()` — showing the
declaration's `[Documentation]` and source (located the same way as definition)
when available — then as a runtime global via `RuntimeSession.describeGlobal()`;
completion items carry `[Documentation]` descriptions; and definition goes to a
local binding's declaring occurrence when the name is one (`localDefinition` in
`src/cli/lsp.references.ts`), else resolves via
`RuntimeSession.resolveDeclaration()` then locates the `[Declaration]`
production's `originalSpan` in a parse `Match` (open buffer preferred, else
session parse state, else a read-only re-parse of the defining `.uff` on disk).
Find-references and rename (`src/cli/lsp.symbols.ts`,
`src/cli/lsp.references.ts`) collect each document's name occurrences from its
parse tree, then search the open documents and the `.uff` files under the
workspace root, parsing only those containing the name (and, for a declaration,
its module's file name, which every import path to it ends with).
`textDocument/completion` parses the text before the cursor and offers items
only for the completion contexts that reach it: `.uff` files and folders
relative to the document in a `[ModulePath]`, the target module's exports in an
`[ImportedName]` (the session's resolved module, else a read-only compile of its
source), and in-scope declarations (via `RuntimeSession.listDeclarations()`) of
the kinds a `[NameReference]` names — rules in patterns, funcs in expressions,
decorators in attributes, any kind in an export list — preceded by the local
bindings visible there (captured variables and lambda parameters in expressions,
`[Parameter]` rule parameters in patterns), which shadow same-named
declarations, and followed in expressions by the runtime globals (via
`RuntimeSession.listGlobals()`) that nothing in scope shadows. The text before
the cursor is parsed as an open input, so empty positions (after a separator,
inside a call) have contexts too. The VS Code extension (requirement 007) has an
initial implementation at `editors/vscode/`: it registers `uffda lsp` for `.uff`
files, registers `uffda mcp` as an MCP server, and resolves/downloads a
compatible `uffda` binary automatically, with debug override settings. The
extension also queries the custom `uffda/languageMetadata` request and assigns
language ids from `[Language].ext` via
`vscode.languages.setTextDocumentLanguage()` for workspace-declared languages.
Its static `language-configuration.json` declares no comments and no brackets,
and its Ctrl+/ command runs the server's `uffda/toggleComment` request
(requirement 009), which toggles through the rule `UffdaLang` names with
`[ToggleComment]`. The LSP config loader fills omitted `extensions` from
`[Language].ext` when `modulePath`/`entryRuleName` are present. See GitHub issue
#155 for the tracking issue. `textDocument/formatting` is implemented for `.uff`
(requirement 008): `LspDocumentManager.format` formats the session's retained
parse when it is clean and current, through the formatter `UffdaLang` names.

## Related

- [CLI specification](../cli.spec.md) — parent chapter; required mode families.
- [MCP server mode](./mcp-server.spec.md) — the sibling agent-facing protocol
  server built on the same runtime pathways.
- [runtime incremental re-parsing](../../runtime/incremental-parsing.spec.md) —
  the reuse contract this mode's document synchronization is built on.
- [Editor metadata](./editor-metadata.spec.md) — the rule-metadata vocabulary
  every syntax-aware capability of this mode reads.
- GitHub issue #155 — origin of this chapter.
- GitHub issue #159 — the `[Token]` rule-metadata mechanism this chapter's
  syntax highlighting section relies on.

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
- This chapter does not yet require it, but implementations SHOULD avoid designs
  that would need to be undone to support it later: a grammar module MAY
  eventually self-declare its own file extension(s) and other editor-facing
  configuration (see "VS Code extension" below) via decorator-derived metadata
  on its entry rule (for example a `[LanguageExtension ".uff"]`-shaped
  decorator, queryable the same way `[token]`/`[Keyword]` metadata already is —
  see [rule metadata](../../runtime/rule-metadata.spec.md)), rather than
  requiring every consumer (the workspace configuration file, an editor
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
- Diagnostics from a downstream pipeline stage MUST be reported at the stage's
  own responsible source-facing range, not merged into or hidden behind an
  upstream stage's diagnostics.

## Syntax highlighting

- The server MUST support `textDocument/semanticTokens` for syntax highlighting,
  deriving token classification from the grammar's own delivered parse tree and
  its rule metadata (see the `[token]` rule-metadata mechanism referenced by
  GitHub issue #159), rather than a separately hand-maintained TextMate-style
  grammar.
- Highlighting MUST be kept current under incremental re-parsing using the same
  document-synchronization contract as diagnostics.

## Hover, navigation, and completions

- The server MUST support `textDocument/hover`, reporting structural information
  about the rule/func/decorator/expression at the requested position, using the
  same descriptive information the MCP server's introspection tools already
  expose (see [introspection tools](./mcp-server.spec.md)).
- The server MUST support go-to-definition (`textDocument/definition`) for
  references to rules, funcs, and decorators, resolving to the declaration's
  source location within the workspace's resolved module graph.
- The server MUST support `textDocument/completion`, offering in-scope
  rule/func/decorator names and, where staticly determinable, expression-level
  completions.
- These capabilities MUST be read-only with respect to runtime/session state:
  none of them MUST mutate a document's parse state as a side effect of being
  queried.

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
- Editor-side language configuration that VS Code itself has no LSP-standard
  equivalent for (comments, brackets, auto-closing/surrounding pairs, word
  pattern) is currently supplied as a static, hand-authored
  `language-configuration.json` scoped to `.uff` only. This chapter does not yet
  require anything more general, but this MUST be treated as interim,
  `.uff`-specific scaffolding, not a pattern to copy-paste per additional
  language: adding a second served language MUST NOT require a second
  hand-authored `language-configuration.json` plus a second static
  `contributes.languages`/`contributes.configuration` entry as the only option.
  The intended direction (see "Language configuration" above) is for the
  extension to derive this configuration dynamically — querying the language
  server for decorator-derived metadata on the grammar's own entry rule and
  calling `vscode.languages.setLanguageConfiguration()` programmatically — and
  to assign a language id to arbitrary configured file extensions at runtime
  (for example via `vscode.languages.setTextDocumentLanguage()` driven by the
  workspace's language configuration file) rather than requiring a statically
  contributed `contributes.languages` entry per language.

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

## Status

`uffda lsp`'s server mode/invocation, language configuration, document
synchronization/incremental re-parsing, and diagnostics (see requirements
001-004 in `.agents/requirements/cli-language-server/`) are implemented,
`.uff`-only, over stdio. Syntax highlighting and hover/navigation/completions
(requirements 005-006) are specified but not yet implemented. The VS Code
extension (requirement 007) has an initial implementation at `editors/vscode/`:
it registers `uffda lsp` for `.uff` files, registers `uffda mcp` as an MCP
server, and resolves/downloads a compatible `uffda` binary automatically, with
debug override settings. See GitHub issue #155 for the tracking issue.

## Related

- [CLI specification](../cli.spec.md) — parent chapter; required mode families.
- [MCP server mode](./mcp-server.spec.md) — the sibling agent-facing protocol
  server built on the same runtime pathways.
- [runtime incremental re-parsing](../../runtime/incremental-parsing.spec.md) —
  the reuse contract this mode's document synchronization is built on.
- GitHub issue #155 — origin of this chapter.
- GitHub issue #159 — the `[token]` rule-metadata mechanism this chapter's
  syntax highlighting section relies on.

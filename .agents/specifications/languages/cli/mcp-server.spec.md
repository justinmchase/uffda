# MCP server mode

This chapter defines the contract for `uffda mcp`, a Model Context Protocol
(MCP) stdio server exposing Uffda's parser, compiler, and runtime to an
agent-driven client as a set of tools, including a live, incrementally
re-parseable in-memory runtime.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Logical purpose

The MCP server exists so an agent can get fast, structured, real-time feedback
while authoring or reasoning about Uffda source — parsing, compiling, loading
modules into a live runtime, evaluating expressions/rules/funcs against that
runtime, and introspecting its structure and metadata — without shelling out to
one-shot CLI invocations per step and without re-parsing whole files on every
edit. It is an additional entry point onto the same deterministic compiler and
runtime pathways the batch CLI and interactive workbench already use, not a
parallel implementation.

This chapter defines only the agent-facing tool contract over the MCP stdio
transport. A human-observable view onto server/session activity (terminal
companion, editor integration) is out of scope here and belongs to its own
chapter(s).

## Transport contract

- `uffda mcp` MUST start an MCP server communicating over standard input/output
  using the standard MCP stdio transport.
- The stdio channel MUST be reserved for MCP protocol traffic (requests,
  responses, notifications). It MUST NOT be reused as a general-purpose
  human-readable log or UI feed.
- Starting the server MUST NOT require any network listener by default.

## Session model

- A **session** is a live, in-memory runtime: a resolver together with the set
  of modules it has loaded, isolated from every other session in the same server
  process.
- The server MUST support zero or more concurrent sessions, each identified by a
  stable session id returned when the session is opened.
- State in one session (loaded modules, resolved declarations, incremental parse
  state) MUST NOT be visible to or mutated by operations against another
  session.
- Closing a session MUST release its in-memory state. Operating against a closed
  or unknown session id MUST fail deterministically rather than silently
  creating or reusing state.
- Session state MUST NOT persist across server process restarts.

## Tool categories

### Stateless operation tools

- The server MUST expose stateless tools equivalent to the batch CLI's
  `compile`, `parse`, and `match` operation modes (see
  [command model](./command-model.spec.md) and
  [compile and stream](./compile-and-stream.spec.md)), for one-shot use that
  does not require a session.
- These tools MUST produce the same deterministic output and diagnostic shape as
  their CLI counterparts for equivalent input.

### Session lifecycle tools

- The server MUST expose tools to open a session, load a source file or module
  into a session (parse, compile, and resolve it against that session's
  resolver), and close a session.
- Loading MUST report diagnostics (parse, compile, or resolution failures)
  without silently discarding partial success information: a load that fails
  MUST still report what, if anything, was resolvable before the failure.
- A successful load MUST report the loaded module's exported rules, funcs, and
  decorators.

### Incremental re-parse tools

- The server MUST expose a tool to apply an edit to an already-loaded source
  within a session and reprocess only the affected region, reusing the session's
  existing parse state for regions unaffected by the edit (see
  [incremental parsing](../../runtime/incremental-parsing.spec.md)).
- An incremental re-parse MUST produce a result equivalent to a full reload of
  the edited source, differing only in performance, not in outcome.

### Evaluation tools

- The server MUST expose a tool to evaluate an expression, or invoke a named
  rule or func, against a loaded session and return a structured result (match
  kind, value, and source span information where applicable).
- Evaluation MUST use the session's live resolved state (including any
  decorator-derived metadata) rather than re-resolving from source on every
  call.

### Introspection and query tools

- The server MUST expose tools to:
  - list a session's loaded modules and their exports;
  - describe a specific rule, func, or decorator declaration, including its
    pattern/expression structure, parameters, and — for rules/funcs — their
    applied attributes and keyed metadata (see
    [rule metadata](../../runtime/rule-metadata.spec.md));
  - query declarations by decorator/metadata key across a session's loaded
    modules.
- Introspection tools MUST reflect the session's current state, including
  effects of any incremental re-parse already applied.

### Match-tree walking tools

- Because a match result tree can be arbitrarily large, the server MUST expose a
  way to traverse a prior evaluation's match tree incrementally (windowed or
  paginated) rather than requiring the full tree to be returned in a single
  response.
- Windowed/paginated traversal MUST be deterministic for a fixed match tree and
  fixed window parameters.

### Source highlighting tool

- The server MUST expose a tool that, given Uffda (or a sub-language's) source
  text, returns a highlighted representation suitable for display to a human,
  classifying spans by syntactic role (for example keyword, identifier, string
  literal, comment) rather than only the coarse lexical token kinds produced by
  tokenization.
- Highlighting output MUST be derived from the same parse/AST span information
  used elsewhere for diagnostics, not a separate, independently maintained
  classification.

## Error and determinism contract

- Every tool MUST produce a deterministic result for a fixed session state and
  fixed arguments.
- Tool failures MUST expose a machine-consumable shape consistent with the batch
  CLI's error-shape contract (see
  [command model](./command-model.spec.md#error-shape-contract)): an error code,
  message, and processing phase.
- A tool operating on an invalid, closed, or unknown session/module/declaration
  reference MUST fail deterministically rather than returning a partial or
  guessed result.

## Composition intent

- The MCP server SHOULD compose the same compiler/resolver/runtime code paths
  used by the batch CLI and interactive workbench rather than introducing a
  parallel implementation of parsing, resolution, or evaluation.
- Tool granularity SHOULD favor small, composable operations (open, load, patch,
  eval, describe, query, walk) over a small number of large "do everything"
  tools, so an agent can build up and inspect runtime state incrementally.

## Status

Specified, not yet implemented. See [command model](./command-model.spec.md) for
the existing shipped CLI modes this chapter's tools sit alongside.

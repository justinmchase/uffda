---
id: mcp-server-014
title: In-memory experiment tool parses and runs snippets without writing files or leaking state
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#in-memory-experiment-tool"
---

# In-Memory Experiment Tool

## Requirement

Preconditions:

- The MCP server is running. No session needs to be open.

Expected behavior:

- The server MUST expose a tool named `uffda_experiment`.
- The tool MUST accept `language` (`uffda` | `pattern` | `expression`) and
  `source`, plus optional sample input(s), `inputIsJson`, an optional module
  `rule` name, and optional expression `variables`.
- It MUST parse `source` in memory and report structured parse success or
  diagnostics (with locations when available). A parse-only call (no sample
  inputs for `pattern`/`uffda`) MUST NOT invent a match or evaluation success.
- For `pattern`, when one or more inputs are supplied, it MUST match the parsed
  pattern against each input independently and report per-input match success,
  failure, captured/projected value, and diagnostics. Text and JSON subjects
  MUST be distinguished via `inputIsJson` (default text).
- For `expression`, it MUST evaluate the parsed expression with default globals
  and any supplied `variables`, returning the value or a compile/execute failure
  — never a fabricated success.
- For `uffda`, it MUST always attempt parse. When inputs (and optional `rule`)
  are supplied, it MUST run the selected exported rule in memory only for
  self-contained modules (no import declarations). Modules with imports MUST
  yield an unsupported-operation failure for the run phase without writing
  artifacts.
- Multiple inputs in one call MUST produce independent, correctly associated
  results and MUST NOT share mutable state across samples or across separate
  tool calls.
- Invoking the tool MUST NOT create, overwrite, or delete files or compiled
  artifacts (including under `./bin`).
- The tool MUST NOT require or accept a session id.

Postconditions:

- An agent can write → run → inspect → revise snippets without sessions or disk
  writes.
- Tests: `src/cli/mcp.experiment.test.ts` (and registration in
  `src/cli/mcp.test.ts`).

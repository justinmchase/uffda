---
id: mcp-server-014
title: In-memory experiment tool runs named cases with compact assertion feedback
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#in-memory-experiment-tool"
---

# In-Memory Experiment Tool

## Requirement

Preconditions:

- The MCP server is running. No session needs to be open.

Expected behavior:

- The server MUST expose `uffda_experiment` in `tools/list` with a description
  that mentions in-memory Uffda/pattern/expression execution, supplied inputs,
  and batch assertions, and with an input schema matching the handler.
- The tool MUST accept `language`, `source`, optional `rule` (modules), optional
  `variables` (expressions), and `cases`: named objects with `input`, optional
  `inputIsJson`, and optionally `expect` (JSON value) or `expectNonMatch`.
- It MUST parse/compile once per request when possible, then run each case
  independently with no state leakage and no filesystem writes (including
  `./bin`).
- Default results MUST be compact: `{ ok, summary, failures? }` (plus
  `parseError` / `unsupported` when needed). Successful ASTs and match trees
  MUST be omitted by default.
- Failures MUST distinguish `assertion`, `match`, `runtime`, `input`, and
  `unsupported`. Assertion failures MUST report expected versus actual. Match
  failures SHOULD include phase/code, input position, concise actual value/type,
  expected pattern/alternatives when analysis provides them, and an
  `into`/`[Pattern]` hint only when a pipeline scalar-vs-iterable mismatch is
  evidenced.
- Modules with import declarations MUST NOT be executed; report unsupported for
  the run phase after a successful parse.
- A representative phone-normalizer style module (strip allowed separators,
  optional leading `+`, bounded digits) MUST be exercisable with named expects
  and expected nonmatches without inventing country-aware numbering behavior.

Postconditions:

- Agents can iterate write → batch-assert → revise with small responses.
- Tests: `src/cli/mcp.experiment.test.ts`, discovery coverage in
  `src/cli/mcp.test.ts`.

---
id: mcp-server-010
title: All tools are deterministic and fail with a CLI-consistent machine-readable error shape
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#error-and-determinism-contract"
---

# Error and Determinism Contract

## Requirement

Preconditions:

- Any MCP tool call is made, with valid or invalid arguments, against a valid,
  invalid, closed, or unknown session/module/declaration/evaluation reference.

Expected behavior:

- For fixed session state and fixed arguments, every tool MUST produce an
  identical result on repeated calls (no reliance on wall-clock time, random ids
  beyond the initial session/evaluation handle assignment, or ambient process
  state).
- Every tool failure MUST expose a machine-consumable error object containing at
  minimum: an error code, a human-readable message, and the processing phase
  that produced it (for example parse, compile, resolution, evaluation,
  session-lookup), consistent with the batch CLI's error-shape contract in
  `.agents/specifications/languages/cli/command-model.spec.md#error-shape-contract`.
- A tool call referencing an invalid, closed, or unknown session, module,
  declaration, or evaluation handle MUST fail with a distinct, identifiable
  error code from ordinary parse/compile/resolution/evaluation failures, so a
  client can distinguish "your reference was invalid" from "the operation itself
  failed."
- No tool MUST silently return a partial or guessed result in place of a
  failure; any partial information returned alongside a failure (004, 005) MUST
  be explicitly labeled as partial in the response shape.

Postconditions:

- An agent driving the server can rely on identical inputs never producing
  divergent outputs, and can programmatically distinguish reference errors from
  language-level failures.

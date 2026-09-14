---
id: mcp-server-011
title: A session display surface is explicit, session-scoped, and renders retained results through one shared transform
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#session-display-surface-tool"
---

# Session Display Surface Tool

## Requirement

Preconditions:

- A session already exists (see 002 session lifecycle).
- A caller has explicitly opened a display surface for that session (see below)
  before attempting to render anything into it.

Expected behavior:

- Opening a session MUST NOT implicitly create a display surface. A display
  surface MUST only come into existence in response to an explicit tool call
  naming the session it belongs to.
- Opening a display surface MUST bind its backing endpoint to loopback only (for
  example `127.0.0.1`), never a wildcard or externally reachable address, so it
  does not become a de facto non-loopback network listener in violation of the
  transport contract's "no network listener by default" requirement.
- Opening a display surface MUST make it human-observable as a real window (not
  returned as MCP tool-call text) before the tool call is considered complete.
- Rendering MUST support, at minimum, both of:
  - a previously retained match result tree (produced by the evaluation tool,
    006, and traversable via the match-tree walking tool, 008); and
  - a source-highlighting result (produced by the source highlighting tool,
    009).
- Both cases MUST be rendered through one shared structured-result-to-markup
  transform, not two independently maintained renderers, so that, for example, a
  decorator's metadata is styled consistently whether it is reached by walking a
  match tree or by highlighting the source that produced it.
- Rendering a second result into an already-open display surface MUST update
  that surface's existing window in place. It MUST NOT open an additional window
  for the same display surface.
- Closing the owning session MUST release its display surface (terminate the
  window and its backing endpoint) as part of releasing that session's state,
  per session lifecycle (002).
- A tool call that renders into, or opens, a display surface for a closed or
  unknown session id MUST fail deterministically per the error and determinism
  contract (010), rather than silently creating one.

Postconditions:

- Rendering the same retained result into the same display surface state twice
  produces identical rendered markup both times.

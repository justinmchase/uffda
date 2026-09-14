---
id: mcp-server-008
title: Match-tree walking supports deterministic windowed/paginated traversal of arbitrarily large results
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#match-tree-walking-tools"
---

# Match-Tree Walking Tool

## Requirement

Preconditions:

- A prior evaluation (006) produced a match result tree referenced by a stable
  handle (for example an evaluation id) within the session.

Expected behavior:

- The tool MUST accept a window/page description (for example a starting path
  into the tree and a maximum number of nodes or depth to return) and MUST
  return only that window, never the full tree unconditionally.
- Two calls with the same evaluation handle and the same window parameters MUST
  return identical results.
- The tool MUST allow walking into any reachable sub-node of the tree (nested
  Ok/Fail/Error results, spans, bound variables) incrementally, so a large
  result can be explored without ever requiring a single unbounded response.
- Requesting a window against an evaluation handle that no longer exists (for
  example after the session was closed) MUST fail deterministically.

Postconditions:

- An agent can inspect a deep or wide match tree from a complex evaluation
  without exceeding a fixed response-size budget on any single tool call.

---
id: mcp-server-016
title: Match projections preserve native Object associations in JSON responses
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#evaluation-tools"
---

# Native Object Match Projection

## Requirement

Preconditions:

- A retained match value contains an Object, including one with non-string keys.

Expected behavior:

- Objects with valid scalar string keys MUST retain ordinary JSON object
  projection.
- Objects with any non-string or non-scalar string key MUST be projected as
  `{"$type":"uffda-object","entries":[[key,value],...]}` in insertion order.
- Non-string keys MUST be represented as
  `{"$type":"uffda-codec-key","value":"<one codec value>"}`.
- Projection MUST preserve each entry and MUST NOT coerce native keys to
  strings.
- This specialized projection MUST NOT weaken ordinary JSON serialization,
  which continues to reject non-string object keys.
- Runtime values not represented by the existing JSON match projection MUST
  retain its established JSON-null projection.

Postconditions:

- Match-tree responses remain valid JSON while retaining native association
  entries.
- Tests: `src/mcp/ops.rs`.

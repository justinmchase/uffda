---
id: incremental-parsing-003
title: Reuse falls back to full re-evaluation whenever reusability cannot be established
spec_ref: ".agents/specifications/runtime/incremental-parsing.spec.md#error-and-negative-behavior"
---

# Conservative Fallback

## Requirement

Preconditions:

- A memo table has been rehydrated from a prior delivered `Match` tree for a
  described edit, per
  [requirement 001](./001-reusable-entries-before-affected-region.requirement.md).
- A position in the fresh, post-edit input corresponding to a candidate reusable
  node's position may or may not exist (for example, because the edit inserted
  content the runtime has not yet indexed, or because a position lookup
  otherwise fails).

Expected behavior:

- If the runtime cannot locate a fresh input position corresponding to an
  otherwise-eligible node (same origin, span ending at or before the edit), it
  MUST skip reusing that node rather than guess or partially reuse it.
- A skipped node MUST still be walked through for reusable descendants, so a
  single lookup failure at one node does not suppress reuse of unrelated,
  genuinely-reusable nodes elsewhere in the tree.
- The runtime MUST NOT reuse any node whose span extends into or past the
  affected region, regardless of how much of that node's content happens to be
  textually unchanged; overlap with the affected region alone is sufficient
  grounds for invalidation.
- Position remapping in this implementation is restricted to edits described
  against a single, flat (single-segment) outermost-layer position. An edit path
  with additional nested segments MUST be treated conservatively: nodes are
  matched for reuse only when their own position is provably outside the
  affected region under this flat model, never assumed reusable by default.

Error behavior:

- The runtime MUST NOT produce a result derived from a mismatched or
  inconsistent combination of prior match state and fresh input; when doubt
  exists about whether a memo entry could have been affected by the edit, it
  MUST be excluded from the rehydrated table.
- A completely empty rehydration result (no reusable nodes found) MUST still
  allow re-evaluation to proceed correctly via ordinary, unmemoized parsing; it
  MUST NOT be treated as a failure of the parse itself.

Postconditions:

- A re-evaluation performed with an incomplete or conservatively-pruned
  rehydrated memo table MUST still produce a result equivalent to a full,
  from-scratch parse of the post-edit input — reuse gaps only ever cost
  performance, never correctness.

---
id: incremental-parsing-001
title: Rule-boundary memo entries entirely before the affected region are reusable across an edit; all others are invalidated
spec_ref: ".agents/specifications/runtime/incremental-parsing.spec.md#core-contract"
---

# Reusable Entries Before The Affected Region

## Requirement

Preconditions:

- A prior parse of an input has completed and delivered a result (a `Match`
  tree), per [runtime rules](../../specifications/runtime/rules.spec.md).
- Proof-driven memo eviction (see
  [runtime memo eviction](../../specifications/runtime/memo-eviction.spec.md))
  has already cleared the parse's own memo table; only the delivered result tree
  remains reachable.
- An edit is described as a single position (`at`) in the pre-edit input's
  outermost, flat stream, marking the start of the affected region, alongside
  `removed`/`inserted` item counts.
- A fresh `Input` over the post-edit sequence is available, sharing identical
  content with the pre-edit sequence at every position strictly before `at`.

Expected behavior:

- The runtime MUST walk the prior delivered `Match` tree and identify every
  `Ok`/`Fail` node that both:
  - carries a recorded rule origin (was produced by a fresh rule invocation; see
    [runtime rules](../../specifications/runtime/rules.spec.md)), and
  - has a span whose end lies at or before the edit's position (`at`).
- Each such node MUST be reinserted into a freshly constructed memo table, keyed
  by its own origin (rule identity and resolved arguments) and start position,
  with its `scope`'s stream reference replaced by the corresponding position in
  the fresh, post-edit `Input`. No other field of the reused node or its nested
  matches MAY be modified.
- Once such a node is captured, the runtime MUST NOT descend into its nested
  matches to capture further (redundant) entries: a memo hit at the captured
  node's position always short-circuits before any of its descendants would be
  consulted during re-evaluation.
- Nodes that lack a recorded origin, or whose span extends into or past the
  affected region, MUST NOT be captured directly, but MUST still be walked
  through so that any reusable descendants nested within them are found.
- A subsequent parse seeded with the rehydrated memo table and the fresh input
  MUST produce a result equivalent in matched value, success/failure outcome,
  and diagnostics to a full parse of the post-edit input performed with no prior
  state at all.

Error behavior:

- If no node in the prior delivered tree qualifies (for example, the edit is at
  or before the first position), the runtime MUST produce an empty rehydrated
  memo table and fall back to full re-evaluation for the entire input; this MUST
  NOT be treated as an error, only as an opportunity for reuse that did not
  materialize.

Postconditions:

- The rehydrated memo table MUST contain only entries whose recorded position
  and consumed span both lie entirely before the affected region.
- Re-evaluation against the rehydrated memo table MUST NOT be observable as a
  difference in outcome from a from-scratch parse: reuse is strictly an
  optimization.

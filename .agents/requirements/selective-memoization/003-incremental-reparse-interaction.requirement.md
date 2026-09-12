---
id: selective-memoization-003
title: Skip-memo rules are recomputed, not captured, during incremental re-parse rehydration
spec_ref: ".agents/specifications/runtime/selective-memoization.spec.md#scope"
---

# Interaction With Incremental Re-Parsing

## Requirement

Preconditions:

- A prior parse's delivered `Match` tree is being walked to rehydrate a memo
  table for incremental re-parsing (see
  [incremental-parsing-001](../incremental-parsing/001-reusable-entries-before-affected-region.requirement.md)).
- A candidate node in that tree carries a `MatchOrigin` whose rule is one this
  chapter's analysis proves safe to skip memoization for (see
  [selective-memoization-001](./001-safe-rules-skip-memo-bookkeeping.requirement.md)).

Expected behavior:

- Such a node MUST NOT be captured into the rehydrated memo table, since the
  rule it originates from never consults the memo table on subsequent invocation
  and an entry for it would never be looked up.
- The node MUST still be walked through so that any reusable descendants nested
  within it are found, exactly as for any other non-captured node.
- A subsequent re-evaluation of the affected rule MUST simply recompute it
  directly against the fresh input; this recomputation MUST produce a match
  outcome and value identical to what the prior, pre-edit parse produced for the
  corresponding unaffected span.

Error behavior:

- None beyond what
  [incremental-parsing-003](../incremental-parsing/003-conservative-fallback.requirement.md)
  already specifies: an entry that is never captured is simply an entry that is
  never available for reuse, which that requirement already establishes as a
  pure performance concern, never a correctness one.

Postconditions:

- Reuse still applies, unaffected, at the nearest ancestor rule origin in the
  tree that is not itself skip-memo eligible: this requirement narrows where
  reuse is captured, it does not reduce the correctness or overall applicability
  of incremental re-parsing.

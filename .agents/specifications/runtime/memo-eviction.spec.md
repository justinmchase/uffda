# Runtime memo eviction

This chapter defines the runtime contract for bounded-memory, first-pass
streaming: parsing a large, previously-unparsed document while evicting memoized
state that can no longer affect the outcome, instead of retaining memo entries
for the entire document for the life of the parse.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Memo eviction exists to serve ingestion of arbitrarily large, new documents
without requiring working memory proportional to the whole document. Packrat
memoization (see [runtime rules](./rules.spec.md)) makes direct left recursion
and backtracking tractable, but naively retaining every rule's memo entry at
every position for the life of a parse means memory scales with document size,
not with grammar complexity. Memo eviction lets the runtime reclaim memo entries
once it can prove no remaining evaluation path can ever observe them again,
bounding working memory for a single first-pass parse.

## Scope

- This chapter governs a single, first-pass parse of a document that has not
  been parsed before — reducing peak/working memory during that parse.
- This chapter does NOT govern re-analysis of an already-parsed document after a
  localized edit. That is a distinct concern with different tradeoffs and is
  defined separately in
  [runtime incremental re-parsing](./incremental-parsing.spec.md). The two
  chapters MUST be treated independently: an implementation MAY support eviction
  without incremental re-parsing, or vice versa, or neither.
- This chapter applies to the packrat/memoized runtime described in
  [runtime rules](./rules.spec.md) and
  [runtime left recursion](./left-recursion.spec.md). Grammar authors MUST
  observe identical match outcomes whether or not memo eviction is active —
  eviction MUST be strictly a memory-management strategy, never a change to
  matching semantics.

## Definitions

- The **low-water mark** at a given point during a parse is the earliest input
  position that any currently-active evaluation path (in-progress rule calls,
  in-progress left-recursive growth loops, and any pending backtracking
  alternative) could still revisit or depend on.
- A memo entry is **provably unreachable** once its position is strictly before
  the current low-water mark: no live growth loop, no pending alternation
  branch, and no enclosing rule frame can ever re-examine that position again
  for the remainder of the parse.
- **Eviction** is the act of discarding a provably-unreachable memo entry (and
  reclaiming the memory it and its associated match value hold) before the parse
  completes.

## Core contract

- Memo eviction MUST NOT change match outcomes. A grammar MUST produce the same
  success/failure/error result, matched value, and diagnostics whether or not
  eviction is active, and regardless of when eviction runs relative to matching.
- The runtime MUST only evict a memo entry once it is provably unreachable per
  the low-water-mark definition above. When reachability cannot be proven, the
  runtime MUST retain the entry rather than risk evicting something a later step
  still depends on.
- The runtime MUST track enough state to compute a correct low-water mark,
  including the positions of all currently-active rule frames, all in-progress
  left-recursive growth loops, and all pending backtracking alternatives that
  have not yet been resolved.
- Eviction MUST be safe to run at any point between discrete evaluation steps
  (for example, after a rule call fully resolves) without observably pausing or
  altering the evaluation in progress.

## Interaction with left recursion and backtracking

- While a left-recursive growth loop for a rule at a given position is
  in-progress (seeded but not yet stabilized, per
  [runtime left recursion](./left-recursion.spec.md)), the runtime MUST NOT
  evict that rule's memo entry at that position, nor any memo entry the
  in-progress growth step depends on.
- The low-water mark MUST NOT advance past a position while any pending
  alternation branch (an unexplored `or` alternative that has not yet been
  attempted or ruled out) could still re-enter that position.
- Once a left-recursive growth loop stabilizes and its final result is recorded,
  and once all alternation branches that could revisit an earlier position have
  been resolved, the low-water mark MAY advance past that position, making its
  now-superseded intermediate memo entries eligible for eviction.

## Error and negative behavior

- The runtime MUST NOT evict a memo entry it cannot prove is unreachable, even
  under memory pressure. Eviction is a proof-driven optimization, not a
  best-effort cache with arbitrary reclamation (for example, LRU-style eviction
  of entries that might still be needed is NOT an acceptable fallback under this
  contract).
- If a subsequent evaluation step requires a memo entry that was evicted, that
  MUST indicate a defect in the low-water-mark computation (an unsafe eviction),
  not a supported "recompute on miss" pathway. The contract requires evicted
  entries to be genuinely unreachable, not merely unlikely to be needed.

## Performance intent

- For grammars and documents where the low-water mark advances roughly in step
  with input position (bounded lookahead, bounded-depth backtracking, and
  left-recursive growth that stabilizes promptly), working memory SHOULD stay
  bounded rather than scale linearly with total document size.
- The runtime MAY fall back to effectively unbounded memory retention for
  pathological grammars whose evaluation paths keep arbitrarily early positions
  reachable for the entire parse (for example, a rule whose alternation defers
  resolution of an early branch until end of input). Eviction MUST remain
  correct in that worst case; it is only required to be a memory optimization,
  never a requirement for correctness.

## Composition and extension intent

- Memo eviction is an optional runtime capability. Implementations MAY run a
  full, unbounded-memory packrat parse and are never required to implement
  eviction.
- This chapter defines the contract memo eviction MUST satisfy. It intentionally
  does not mandate a specific low-water-mark tracking data structure or
  algorithm — those are implementation and requirement-level decisions to be
  validated against this contract (including empirical prototyping against
  realistic large documents) before being finalized.

## Why this design

- Bounding working memory for a first-pass parse is only valuable if it never
  risks correctness: a proof-driven eviction contract (evict only what is
  provably unreachable) keeps this feature strictly additive, the same way
  [runtime incremental re-parsing](./incremental-parsing.spec.md)'s
  conservative-fallback-on-doubt rule keeps that feature strictly additive.
- Tying eviction eligibility to left-recursion growth stabilization and
  unresolved alternation branches (rather than a simpler "evict everything
  before the current position" rule) is necessary because DLR and backtracking
  are exactly the cases where a later evaluation step can revisit an earlier
  position; a naive position-only rule would be unsound for the grammars this
  runtime is designed to support.
- This is intentionally the lower-priority of the two streaming concerns
  identified in issue #149: incremental re-parsing (see
  [runtime incremental re-parsing](./incremental-parsing.spec.md)) serves the
  more concrete editor/live-diagnostics use case, while this chapter serves bulk
  ingestion of new large documents, which is a real but comparatively less
  urgent target.

## Related

- [runtime rules](./rules.spec.md) — packrat memoization by input position and
  rule identity, which memo eviction reclaims once entries are unreachable.
- [runtime left recursion](./left-recursion.spec.md) — seed-and-grow evaluation
  whose in-progress growth loops constrain when the low-water mark may advance.
- [runtime incremental re-parsing](./incremental-parsing.spec.md) — the
  distinct, edit-driven re-analysis concern this chapter explicitly excludes.
- GitHub issue #149 — origin of this chapter, split from the incremental
  re-parsing concern as the other of the two streaming/large-file problems
  identified there.

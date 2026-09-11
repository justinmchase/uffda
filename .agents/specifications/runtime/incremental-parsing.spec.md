# Runtime incremental re-parsing

This chapter defines the runtime contract for incremental re-parsing: reusing
prior parse state to re-analyze a document after a localized edit, instead of
re-running a full parse from scratch.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Incremental re-parsing exists to serve real-time, edit-driven consumers of a
Uffda grammar — for example editor syntax highlighting and live error
diagnostics — where a document is parsed once, then repeatedly re-analyzed as a
user makes small, localized edits. Re-running a full parse on every keystroke is
correct but does not scale to large documents at interactive latency.
Incremental re-parsing lets the runtime reuse memoized outcomes that an edit
could not have affected, and re-evaluate only the region an edit could have
affected.

## Scope

- This chapter governs re-analysis of an **already-parsed** document after a
  **localized edit** to that same document.
- This chapter does NOT govern bounded-memory streaming of a **new**,
  previously-unparsed large document (memo eviction during a first pass). That
  is a distinct concern with different tradeoffs and is deferred to separate
  future work.
- This chapter applies to the packrat/memoized runtime described in
  [runtime rules](./rules.spec.md) and
  [runtime left recursion](./left-recursion.spec.md). It does not change grammar
  authoring: a grammar that supports direct left recursion (DLR) and
  backtracking MUST continue to behave identically whether a given parse was
  produced by a full parse or by incremental re-parsing.

## Definitions

- An **edit** is a description of a single localized change to a document's
  content: a replaced span of the prior document (possibly empty, for pure
  insertion) and its replacement content (possibly empty, for pure deletion).
- The **affected region** of an edit is the replaced span itself, plus any
  additional span the runtime must conservatively treat as changed because
  content shifted position around it.
- A memo entry (see [runtime rules](./rules.spec.md)) is **reusable** across an
  edit only if the runtime can establish that neither the rule's outcome nor
  anything it observed while producing that outcome could have differed had the
  edit already been applied.
- **Position remapping** is the process of translating a stream position (or
  memo key) that was valid in the pre-edit document into its corresponding
  position in the post-edit document, for positions outside the affected region.

## Core contract

- Incremental re-parsing MUST produce a result equivalent to a full re-parse of
  the post-edit document from scratch. Reuse of prior parse state MUST be an
  optimization only; it MUST NOT be observable as a difference in match outcome,
  matched value, diagnostics, or left-recursion behavior.
- The runtime MUST be able to accept an edit description against a prior parse
  and MUST NOT require discarding all prior memoized state as the only correct
  response to an edit.
- A memo entry MUST be treated as invalidated, not reusable, whenever any of the
  following hold:
  - Its recorded position falls inside the affected region.
  - The span of input it consumed (from its start position through the position
    it left the stream at) overlaps the affected region.
  - It was produced during an in-progress left-recursive growth loop (see
    [runtime left recursion](./left-recursion.spec.md)) that had not yet
    stabilized at the time of the edit.
- Memo entries whose recorded position and consumed span both fall entirely
  outside the affected region MAY be reused, provided their position has been
  correctly remapped to the post-edit document.
- When the runtime cannot establish that a memo entry is reusable under the
  above rules, it MUST treat that entry as invalidated and fall back to
  re-evaluation rather than risk incorrect reuse. Correctness MUST always take
  priority over reuse.
- Incremental re-parsing MUST NOT be triggered while a parse is in progress.
  Edits apply between complete, stabilized parses, not concurrently with
  in-flight evaluation.

## Interaction with left recursion and backtracking

- Reused memo entries MUST preserve the same caller-visible outcomes that
  [runtime rules](./rules.spec.md) and
  [runtime left recursion](./left-recursion.spec.md) require of a full parse: a
  reused entry for a rule with a projection expression MUST still be the
  post-projection, caller-visible value, not a raw intermediate.
- Because left-recursive growth explores a rule repeatedly at a single fixed
  position and depends on everything reachable during that growth, the runtime
  MUST treat the entire set of memo entries produced by a single growth loop as
  a unit for invalidation purposes: if any entry from that loop is invalidated,
  the runtime MUST invalidate the loop's other entries at that position rather
  than reuse a partially-stale growth result.
- Backtracking (alternation) MUST continue to explore branches in the order
  defined by [pattern matching](../patterns.spec.md) even when some branches'
  outcomes are served from reused memo entries and others are freshly evaluated;
  branch order and semantics MUST NOT depend on which branches were reused.

## Position remapping

- The runtime MUST define a position-remapping strategy that lets memo entries
  recorded before an edit be looked up correctly after the edit, for positions
  outside the affected region.
- Position remapping MUST be consistent with the [modules](../modules.spec.md)
  and stream model: a remapped position MUST refer to the same logical stream
  location (same upcoming content) as its pre-edit counterpart.
- The runtime MAY require the host (the code driving incremental re-parsing) to
  supply the edit description explicitly; it MUST NOT infer edits by diffing
  arbitrary opaque document representations.

## Error and negative behavior

- An edit description that the runtime cannot reconcile with its prior parse
  state (for example, an edit against a document version the runtime has no
  record of) MUST be rejected or MUST fall back to a full re-parse; it MUST NOT
  silently produce a result derived from mismatched prior state.
- Invalidation MUST be conservative: when in doubt about whether a memo entry
  could have been affected by an edit, the runtime MUST invalidate it.

## Performance intent

- For edits whose affected region is small relative to the document, and for
  grammars where rule outcomes at a given position typically do not depend on
  content arbitrarily far away, incremental re-parsing SHOULD require work
  roughly proportional to the affected region plus the cost of position
  remapping, not to the full document size.
- The runtime MAY fall back to full re-parse cost in the worst case (for
  example, grammars whose outcomes at early positions depend on content near the
  end of the document, or edits that are not conservatively boundable).
  Incremental re-parsing MUST remain correct in that worst case; it is only
  required to be an optimization, never a requirement for correctness.

## Composition and extension intent

- Incremental re-parsing is an optional runtime capability. Hosts and embedding
  tools MAY always perform a full parse and are never required to use
  incremental re-parsing.
- This chapter defines the contract incremental re-parsing MUST satisfy. It
  intentionally does not mandate a specific memo data structure, edit API shape,
  or invalidation algorithm — those are implementation and requirement- level
  decisions to be validated against this contract (including empirical
  prototyping against realistic documents) before being finalized.

## Why this design

- Editor tooling (syntax highlighting, live diagnostics) is the concrete,
  higher-value use case motivating streaming/large-file support, more so than
  bounded-memory ingestion of a brand-new large file (see Scope).
- Packrat memoization already records outcomes per rule and per position, which
  is a natural fit for incremental reuse: unlike parsers without memoization,
  Uffda's runtime already has the granularity needed to reason about "what did
  this parse depend on" at the level of individual rule/ position pairs, rather
  than needing to introduce that granularity solely for this feature.
- Requiring conservative fallback to full re-evaluation whenever reuse cannot be
  proven safe keeps this feature strictly additive: a correct implementation can
  start with very conservative (large) affected regions and narrow them over
  time without ever risking incorrect results.

## Related

- [runtime rules](./rules.spec.md) — packrat memoization by input position and
  rule identity, which incremental re-parsing extends across edits.
- [runtime left recursion](./left-recursion.spec.md) — seed-and-grow evaluation
  whose in-progress and stabilized memo entries are subject to the invalidation
  rules in this chapter.
- GitHub issue #149 — origin of this chapter, including the deferred, separate
  bounded-memory first-pass streaming concern (memo eviction for new large
  documents), tracked independently of incremental re-parsing.

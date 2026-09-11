# Runtime incremental re-parsing

This chapter defines the runtime contract for incremental re-parsing: reusing
prior parse state to re-analyze an input after a localized edit, instead of
re-running a full parse from scratch.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Incremental re-parsing exists to serve real-time, edit-driven consumers of a
Uffda grammar — for example editor syntax highlighting and live error
diagnostics — where an input is parsed once, then repeatedly re-analyzed as a
user makes small, localized edits. Re-running a full parse on every keystroke is
correct but does not scale to large inputs at interactive latency. Incremental
re-parsing lets the runtime reuse memoized outcomes that an edit could not have
affected, and re-evaluate only the region an edit could have affected.

## Scope

- This chapter governs re-analysis of an **already-parsed input** after a
  **localized edit** to that same input.
- This chapter is deliberately input-shape-agnostic. Unlike many parser/compiler
  designs that assume every pipeline stage operates on text, a Uffda
  [rule](./rules.spec.md) matches over a generic `Input` stream, whose items MAY
  be characters, but MAY equally be tokens, objects, arrays, or any other
  JavaScript value produced by an earlier pipeline stage. Everything in this
  chapter (edit, affected region, position, position remapping) is defined in
  terms of stream positions and stream items in general, not text offsets or
  characters specifically.
- This chapter does NOT govern bounded-memory streaming of a **new**,
  previously-unparsed large input (memo eviction during a first pass). That is a
  distinct concern with different tradeoffs, defined separately in
  [runtime memo eviction](./memo-eviction.spec.md). The two chapters MUST be
  treated independently: an implementation MAY support one without the other. A
  memo entry excluded from eviction because it is reachable from a layer's
  delivered result (see that chapter's reachability rule) is exactly the kind of
  entry this chapter's reuse rules operate against.
- This chapter applies to the packrat/memoized runtime described in
  [runtime rules](./rules.spec.md) and
  [runtime left recursion](./left-recursion.spec.md). It does not change grammar
  authoring: a grammar that supports direct left recursion (DLR) and
  backtracking MUST continue to behave identically whether a given parse was
  produced by a full parse or by incremental re-parsing.
- Uffda compiler pipelines are commonly composed of multiple layers (for
  example: normalization, tokenization, parsing, lowering), where each layer is
  itself a grammar whose rules match over the previous layer's output stream as
  its input. See "Multi-stage pipelines" below for how this chapter's contract
  composes across such layers.

## Definitions

- An **edit** is a description of a single localized change to an input's
  content: a replaced span of the prior input (possibly empty, for pure
  insertion) and its replacement content (possibly empty, for pure deletion).
  The replaced and replacement content are sequences of stream items of whatever
  type that layer's input stream carries (characters, tokens, or any other
  value) — not necessarily text.
- The **affected region** of an edit is the replaced span itself, plus any
  additional span the runtime must conservatively treat as changed because
  content shifted position around it.
- A memo entry (see [runtime rules](./rules.spec.md)) is **reusable** across an
  edit only if the runtime can establish that neither the rule's outcome nor
  anything it observed while producing that outcome could have differed had the
  edit already been applied.
- **Position remapping** is the process of translating a stream position (or
  memo key) that was valid in the pre-edit input into its corresponding position
  in the post-edit input, for positions outside the affected region.

## Core contract

- Incremental re-parsing MUST produce a result equivalent to a full re-parse of
  the post-edit input from scratch. Reuse of prior parse state MUST be an
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
  correctly remapped to the post-edit input.
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
  arbitrary opaque input representations.

## Multi-stage pipelines

- A Uffda compiler is commonly expressed as a chain of layers (for example:
  normalization, tokenization, parsing, lowering), where each layer is its own
  grammar whose rules match over the previous layer's delivered output as its
  input stream. Each layer therefore has its own rule set, its own input stream,
  and its own memo state, independent of every other layer's.
- An edit MUST be described against exactly one layer's input (typically the
  outermost/source layer). The runtime MUST NOT require a host to separately
  describe the "same" edit again for each downstream layer.
- The runtime MUST derive each downstream layer's affected region from its
  upstream layer's affected region and delivered output — specifically, from the
  span of the upstream layer's output that could have changed as a result of the
  upstream edit and any upstream re-evaluation it triggered — not by applying
  the original edit's raw content or position directly to a downstream layer's
  differently-shaped input.
- A downstream layer's affected region MAY be smaller, larger, or structurally
  unrelated in size to the original edit. For example, an edit entirely inside a
  token's interior content that does not change that token's boundaries or
  emitted value MAY leave every downstream layer's affected region empty; an
  edit that changes token boundaries MAY affect many downstream positions even
  though the original edit was small.
- Each layer's memo reuse MUST be evaluated using this chapter's rules
  independently, against that layer's own affected region, rule set, and memo
  state. A layer MUST NOT reuse a memo entry merely because an upstream layer's
  corresponding region was reusable; each layer determines its own reusability
  from its own affected region.
- If any layer cannot determine its affected region precisely (for example,
  because its upstream layer's re-evaluation could not itself be scoped to a
  proven region), that layer MUST conservatively treat its entire input as
  affected, per this chapter's general fallback rule of invalidating whenever
  reusability cannot be established.

## Error and negative behavior

- An edit description that the runtime cannot reconcile with its prior parse
  state (for example, an edit against an input version the runtime has no record
  of) MUST be rejected or MUST fall back to a full re-parse; it MUST NOT
  silently produce a result derived from mismatched prior state.
- Invalidation MUST be conservative: when in doubt about whether a memo entry
  could have been affected by an edit, the runtime MUST invalidate it.

## Performance intent

- For edits whose affected region is small relative to the input, and for
  grammars where rule outcomes at a given position typically do not depend on
  content arbitrarily far away, incremental re-parsing SHOULD require work
  roughly proportional to the affected region plus the cost of position
  remapping, not to the full input size. In a multi-stage pipeline, this SHOULD
  hold per layer: a layer whose own affected region stays small SHOULD do
  correspondingly little work, independent of how much work upstream layers did.
- The runtime MAY fall back to full re-parse cost in the worst case (for
  example, grammars whose outcomes at early positions depend on content near the
  end of the input, or edits that are not conservatively boundable, or a layer
  whose upstream affected region could not be scoped precisely). Incremental
  re-parsing MUST remain correct in that worst case; it is only required to be
  an optimization, never a requirement for correctness.

## Composition and extension intent

- Incremental re-parsing is an optional runtime capability. Hosts and embedding
  tools MAY always perform a full parse and are never required to use
  incremental re-parsing.
- Because each pipeline layer's memo state is independent, a host MAY enable
  incremental re-parsing for only some layers of a pipeline (for example, only
  the outermost source-facing layers relevant to editor tooling) while other
  layers always fully re-evaluate.
- This chapter defines the contract incremental re-parsing MUST satisfy. It
  intentionally does not mandate a specific memo data structure, edit API shape,
  or invalidation algorithm — those are implementation and requirement-level
  decisions to be validated against this contract (including empirical
  prototyping against realistic inputs, including non-text pipeline layers)
  before being finalized.

## Why this design

- Editor tooling (syntax highlighting, live diagnostics) is the concrete,
  higher-value use case motivating streaming/large-input support, more so than
  bounded-memory ingestion of a brand-new large input (see Scope).
- Packrat memoization already records outcomes per rule and per position, which
  is a natural fit for incremental reuse: unlike parsers without memoization,
  Uffda's runtime already has the granularity needed to reason about "what did
  this parse depend on" at the level of individual rule/position pairs, rather
  than needing to introduce that granularity solely for this feature.
- Requiring conservative fallback to full re-evaluation whenever reuse cannot be
  proven safe keeps this feature strictly additive: a correct implementation can
  start with very conservative (large) affected regions and narrow them over
  time without ever risking incorrect results.
- Uffda deliberately does not assume a single text-in, tree-out pipeline shape:
  each compiler layer is itself a grammar, and layers may consume streams of
  tokens, objects, arrays, or other JavaScript values rather than characters.
  Defining edits, affected regions, and reuse purely in terms of stream
  positions (rather than text offsets) lets this contract apply uniformly to
  every layer of a pipeline, not only to the outermost text-facing one.

## Related

- [runtime rules](./rules.spec.md) — packrat memoization by input position and
  rule identity, which incremental re-parsing extends across edits.
- [runtime left recursion](./left-recursion.spec.md) — seed-and-grow evaluation
  whose in-progress and stabilized memo entries are subject to the invalidation
  rules in this chapter.
- [runtime memo eviction](./memo-eviction.spec.md) — the distinct, first-pass
  bounded-memory concern this chapter explicitly excludes, and whose
  reachability rule defines exactly which stabilized memo entries survive long
  enough for this chapter's reuse rules to apply to them.
- GitHub issue #149 — origin of this chapter and of
  [runtime memo eviction](./memo-eviction.spec.md), the two streaming/
  large-input problems identified there.

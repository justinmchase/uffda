# Runtime selective memoization

This chapter defines the runtime contract for selective memoization: skipping
packrat memo bookkeeping for a rule invocation when the rule's own static
structure proves it can never be re-entered at the same input position.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Packrat memoization (see [runtime rules](./rules.spec.md) and
[runtime left recursion](./left-recursion.spec.md)) exists to make direct left
recursion tractable and to avoid redundant re-evaluation when a rule is
genuinely re-entered ambiguously at the same position (for example, from
multiple sibling alternatives in an `Or`/`Switch`). That guarantee has a real,
non-zero cost per invocation: deriving a packrat key from the rule and its
resolved arguments, looking it up, and — on a miss — recording the result and
tracking it for eviction.

Profiling a real grammar's compile (`examples/morse/morse.uff`) showed this cost
is not evenly distributed: many high-volume rules (for example straight-line
character-class helpers visited exactly once per input position, such as a
tokenizer's per-character dispatch rules) showed an exact 0% memo hit rate —
every invocation was a first-time miss, meaning the memo bookkeeping they paid
on every single call had zero payoff. Selective memoization lets the runtime
recognize such rules ahead of time and skip that bookkeeping for them entirely,
while leaving genuinely re-enterable rules (which do benefit from memoization)
unaffected.

## Scope

- This chapter governs a single rule's _own_ invocation-time bookkeeping
  decision: whether to consult/populate the packrat memo table at all when that
  rule is invoked (see [runtime rules](./rules.spec.md)).
- This chapter does not change matching semantics: whether or not a rule's
  invocation is memoized, its match outcome (success/failure/error, matched
  value, and diagnostics) MUST be identical either way. This is strictly a
  bookkeeping-cost optimization.
- This chapter's analysis is static: it inspects a rule's own pattern structure
  and its module's rule/import graph once, and caches its conclusion for that
  rule for the lifetime of the process. It does not observe runtime hit/miss
  behavior and does not change its conclusion based on the input being parsed.
- This chapter interacts with, but does not modify the contract of,
  [runtime incremental re-parsing](./incremental-parsing.spec.md): a rule this
  chapter proves safe to skip memoization for is never captured as a reusable
  entry during rehydration (see that chapter's "reusable entries" behavior),
  since such a rule never consults the memo table in the first place. That
  chapter's own contract already treats a missing reusable entry as strictly a
  performance concern, never a correctness one, so this composes without
  conflict. In practice this is not a meaningful loss: a rule this chapter
  proves safe to skip is, by construction, cheap (no calls, or calls only to
  other equally provably-safe rules), so recomputing it directly on a rehydrated
  re-parse costs about what a memo lookup would have anyway. Reuse continues to
  apply, unaffected, at the nearest ancestor rule that remains memoized.
- This chapter never changes whether a rule participates in
  [runtime left recursion](./left-recursion.spec.md) growth: a rule this
  analysis proves safe to skip memoization for can never be part of a call cycle
  (see "Analysis" below), so it can never itself require left-recursion growth.
  A rule that does participate in any call cycle is always excluded from this
  optimization and remains fully memoized.

## Analysis

A rule is safe to skip memoization for if and only if all of the following hold:

- It declares no parameters. Parameterized (generic/higher-order) rules are not
  analyzed by this chapter; they are always conservatively treated as requiring
  memoization.
- Every call it can make is statically resolvable to a single, concrete rule:
  - A reference call with no arguments, whose name resolves to a rule declared
    or imported in the calling rule's own module.
  - A direct reference to a specific rule value (for example, one embedded by a
    host-provided pattern), not a value selected at runtime.
- None of the following appear anywhere in its reachable call structure:
  - A call that resolves a module's default export at run time rather than a
    statically pinned rule (this chapter cannot know which rule that will be
    ahead of time).
  - A call that passes rule-valued arguments (the callee's behavior then depends
    on the call site, which this chapter does not attempt to simulate).
  - A reference name that does not resolve to any rule or import visible to the
    calling rule.
  - A parameterized rule (transitively reached).
- It is not reachable from itself through those calls — directly (it calls
  itself) or indirectly (mutual recursion through any number of intermediate
  rules).

Any rule for which this cannot be established MUST be conservatively treated as
requiring memoization. This chapter never allows an implementation to skip
memoization for a rule it cannot prove safe — doing so would risk incorrect
behavior for direct or indirect left recursion, or for rules genuinely
re-entered ambiguously by sibling alternatives.

A rule that itself makes no calls that could reach a cyclic rule remains
eligible for this optimization even when some other, unrelated rule elsewhere in
the same module participates in a cycle: only a rule's own reachability back to
itself matters, not whether cycles exist anywhere in the broader grammar.

## Interactions

- This chapter's analysis result for a given rule MUST NOT vary based on which
  position, or how many times, the rule is invoked during a parse: it is a
  property of the rule's declaration, not of any particular evaluation.
- A rule invocation that skips memoization per this chapter MUST still produce a
  match result carrying the same `MatchOrigin` (rule identity and resolved
  arguments) an ordinarily-memoized invocation would, so that diagnostics,
  incremental re-parsing's tree walk, and any other consumer of origin-tagged
  results continue to work unchanged.
- Implementations MAY still track a skipped rule's currently-active input
  position for the purposes of
  [runtime memo eviction](./memo-eviction.spec.md)'s low-water-mark bookkeeping,
  even though the rule itself records no memo entry, so that eviction for
  _other_, still-memoized rules remains accurate.

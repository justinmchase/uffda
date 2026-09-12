---
id: incremental-parsing-002
title: A memo entry's originating rule and resolved arguments are recoverable from the delivered result tree
spec_ref: ".agents/specifications/runtime/incremental-parsing.spec.md#definitions"
---

# Rule-Boundary Origin Tracking

## Requirement

Preconditions:

- Proof-driven memo eviction (see
  [runtime memo eviction](../../specifications/runtime/memo-eviction.spec.md))
  clears a parse's memo table once it completes; only the delivered `Match` tree
  remains reachable through ordinary JavaScript reachability.
- Incremental re-parsing (this chapter) needs to reconstruct a memo table from
  that tree alone, which requires recovering, for each retained node, which rule
  and resolved arguments produced it — the packrat memo key identity described
  in [runtime rules](../../specifications/runtime/rules.spec.md).

Expected behavior:

- Every `Ok`/`Fail` match produced directly by a fresh (non-memo-hit) rule
  invocation MUST record the originating rule and its fully resolved arguments
  (its `MatchOrigin`) on that match value itself, at the one point in the
  runtime that already holds both pieces of identity together.
- A match produced by any other pattern kind (a combinator, a memo-hit wrapper,
  or any non-rule-boundary construct) MUST NOT record an origin; the absence of
  an origin MUST be treated as "not itself a rule boundary," not as an error.
- Recording an origin MUST NOT alter a match's `kind`, `pattern`, `scope`,
  `span`, `value`, or `matches` — it is a strictly additive, optional field that
  changes no existing match-comparison or serialization behavior for code that
  does not consult it.

Error behavior:

- N/A — origin recording is bookkeeping only; it MUST NOT raise or otherwise
  change match outcomes, and its absence on a given node MUST NOT prevent
  correct evaluation of that node (a node without an origin is simply never a
  candidate for direct reuse; the runtime still walks through it to look for
  reusable descendants).

Postconditions:

- Given only a delivered `Match` tree (with no access to the original,
  possibly-evicted memo table), the runtime MUST be able to recover, for every
  origin-tagged node, the exact `(rule, args, position)` identity that a packrat
  memo lookup for that same invocation would have used during the original
  parse.

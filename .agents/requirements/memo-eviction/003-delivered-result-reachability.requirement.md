---
id: memo-eviction-003
title: Eviction never invalidates a parse's delivered result
spec_ref: ".agents/specifications/runtime/memo-eviction.spec.md#interaction-with-delivered-results"
---

# Delivered-Result Reachability

## Requirement

Preconditions:

- A parse has produced a delivered result (the top-level rule's successful
  outcome, or an intermediate pipeline layer's output stream consumed by a
  downstream layer).
- The host or a downstream layer retains a reference to that delivered result,
  or to some value nested within it.

Expected behavior:

- The runtime MUST NOT rely on a separate "durable cache" mechanism to keep
  delivered-result values alive. Ordinary JavaScript reachability (a matched
  value nested inside another match's accepted structure) MUST be sufficient to
  keep any value the delivered result references alive regardless of whether the
  memo table's own entry pointing to that same value has been evicted.
- Evicting a memo table entry MUST only remove the memo table's own reference to
  a value. It MUST NOT be the only reference keeping that value alive if the
  value is also part of the accepted parse tree.

Error behavior:

- N/A — this is a safety property of eviction, not a distinct error path.

Postconditions:

- A host that discards a parse's delivered result immediately after use MUST
  observe no additional memory retained by the memo table beyond what ordinary
  garbage collection would otherwise reclaim.
- A host that retains a parse's delivered result (for example, to feed a
  downstream pipeline layer) MUST continue to observe correct, complete values
  reachable from that result, even after the memo table has evicted entries for
  positions the delivered result does not depend on.

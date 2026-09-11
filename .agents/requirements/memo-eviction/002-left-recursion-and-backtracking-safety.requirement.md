---
id: memo-eviction-002
title: Left-recursive growth and pending alternation branches keep their memo entries reachable until resolved
spec_ref: ".agents/specifications/runtime/memo-eviction.spec.md#interaction-with-left-recursion-and-backtracking"
---

# Left Recursion and Backtracking Safety

## Requirement

Preconditions:

- A rule's evaluation involves a left-recursive seed-and-grow loop, an `Or`
  alternation with unexplored branches, or both, at a given stream position.
- That rule's frame is on the runtime's active-frame stack for the entire
  duration of the seed-and-grow loop and for the entire duration of evaluating
  each alternation branch.

Expected behavior:

- The runtime MUST NOT evict a rule's memo entry at a position while a
  left-recursive growth loop for that rule at that position is in progress
  (seeded but not yet stabilized).
- The runtime MUST NOT advance the low-water mark past a position while any
  pending, unresolved alternation branch could still re-enter that position.
- Once a growth loop stabilizes and its final result is recorded, and once every
  alternation branch that could revisit a position has resolved (all branches
  attempted, or the position's enclosing rule frame has returned), the runtime
  MAY advance the low-water mark past that position.

Error behavior:

- If a subsequent evaluation step requires a memo entry that was evicted, this
  MUST be treated as a defect in low-water-mark computation, not a supported
  "recompute on miss" pathway.

Postconditions:

- A rule using left recursion or alternation MUST produce the same match result
  with eviction active as without it, including when a second `Or` branch
  re-enters a rule already memoized from the first branch's attempt at the same
  position.

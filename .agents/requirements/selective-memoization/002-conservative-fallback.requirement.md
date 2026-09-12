---
id: selective-memoization-002
title: Anything the analysis cannot prove safe is conservatively memoized
spec_ref: ".agents/specifications/runtime/selective-memoization.spec.md#analysis"
---

# Conservative Fallback

## Requirement

Preconditions:

- A rule is being evaluated for eligibility to skip memo bookkeeping.

Expected behavior:

- A rule that declares one or more parameters MUST be treated as requiring
  memoization, without further analysis of its call structure.
- A rule that calls another rule via a reference passing one or more arguments
  MUST be treated as requiring memoization for that call site, and therefore for
  the calling rule as a whole.
- A rule that resolves a module's default export at run time (rather than a
  single, statically pinned rule) MUST be treated as requiring memoization.
- A rule that references a name which does not resolve to any rule or import
  visible to it MUST be treated as requiring memoization.
- A rule that is, directly or indirectly, reachable from itself through any
  chain of statically-resolved calls MUST be treated as requiring memoization —
  including every rule that participates in that cycle, not only the rule where
  the cycle was first detected.
- A rule whose reachable call structure includes any rule that itself requires
  memoization for one of the reasons above MUST also be treated as requiring
  memoization, since that rule's true reachable set cannot be established
  without knowing what the unresolved rule may itself reach.

Error behavior:

- None: falling back to memoization is always a safe, correctness-preserving
  default. This requirement has no failure mode of its own; it exists to bound
  requirement
  [selective-memoization-001](./001-safe-rules-skip-memo-bookkeeping.requirement.md)
  to only the cases it can prove.

Postconditions:

- No rule is ever incorrectly skipped: the analysis MUST NOT produce a false
  "safe to skip" conclusion for any rule that could actually be re-entered
  ambiguously at the same position, whether through direct recursion, mutual
  recursion, or an unanalyzable (dynamic) call.

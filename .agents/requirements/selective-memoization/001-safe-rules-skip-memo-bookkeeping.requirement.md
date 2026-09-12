---
id: selective-memoization-001
title: Rules provably never re-enterable at the same position skip packrat memo bookkeeping
spec_ref: ".agents/specifications/runtime/selective-memoization.spec.md#analysis"
---

# Safe Rules Skip Memo Bookkeeping

## Requirement

Preconditions:

- A rule declares no parameters.
- Every call the rule can make (directly, or transitively through other rules it
  calls) is statically resolvable to a single, concrete rule — no call resolves
  a module's default export at run time, passes rule-valued arguments, or
  references an unresolvable name.
- The rule is not reachable from itself through those calls, directly or through
  any chain of intermediate rules.

Expected behavior:

- Invoking such a rule MUST NOT consult or populate the packrat memo table (see
  [runtime rules](../../specifications/runtime/rules.spec.md)): no key
  derivation, lookup, or entry storage occurs for that invocation.
- The rule's match outcome (success, failure, or error; matched value;
  diagnostics) MUST be identical to what an ordinarily-memoized invocation of
  the same rule, over the same input, would have produced.
- The match result MUST still carry the rule's `MatchOrigin` (rule identity and
  resolved arguments), exactly as an ordinarily-memoized invocation's result
  would.
- This determination MUST be made once per rule (not recomputed per invocation)
  and MUST NOT vary across repeated invocations of the same rule.

Error behavior:

- If a rule this requirement applies to somehow yields a left-recursion growth
  signal during matching, the runtime MUST treat this as an internal invariant
  violation (surfaced as an error), not as ordinary left-recursion growth — such
  a rule is proven unable to reach itself, so this can only indicate a defect in
  the analysis itself.

Postconditions:

- A grammar's overall parse result is unaffected by whether any individual
  rule's invocation was memoized or not: this requirement changes bookkeeping
  cost only, never observable behavior.

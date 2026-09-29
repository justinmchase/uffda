---
id: indirect-left-recursion-002
title: Outcomes computed against a left-recursive seed are reused only while that seed is current
spec_ref: ".agents/specifications/runtime/left-recursion.spec.md#seed-dependent-outcomes; .agents/specifications/runtime/left-recursion.spec.md#memoization-eviction-and-incremental-interactions; .agents/specifications/runtime/incremental-parsing.spec.md#interaction-with-left-recursion-and-backtracking"
---

# Seed-Dependent Outcome Reuse

## Requirement

Preconditions:

- A cycle head is growing at some input position, and other rule invocations at
  that position observe its seed directly or through other seed-dependent
  outcomes.

Expected behavior:

- An outcome that observed the seed only by reusing another seed-dependent
  outcome MUST itself be treated as seed-dependent and recomputed after the seed
  changes (`A = B "q" | Y "x" | "a"; Y = B; B = A "y" | "b"` over `ayx` yields
  `[["a", "y"], "x"]`).
- An outcome last computed in a superseded iteration MUST be recomputed when
  reached after growth completes, rather than reused.
- An outcome computed in the head's final iteration MAY be reused after growth
  completes, and MUST equal what recomputation against the head's final outcome
  would produce.
- Within one growth iteration, an involved rule reached from several call sites
  SHOULD be evaluated once.
- A rule outcome that observed a seed MUST record that fact on its match origin,
  and incremental rehydration MUST NOT capture such an outcome on its own.

Postconditions:

- Memo reuse during left-recursive growth never exposes an outcome computed
  against a stale seed, in a full parse or an incremental re-parse.

## Test plan

- `src/requirements/patterns/indirect-left-recursion-002-seed-dependent-reuse.requirement.test.ts`
  covers the transitive, superseded, final-iteration, and within-iteration cases
  (the last by counting evaluations of a projection in the involved rule).
- `src/memo.test.ts` (`MEMO_SEED_*`) covers dependency recording, staleness, and
  nested dependency chains at the `Memos` level.
- `src/runtime/rule.test.ts` (`RULE14`) asserts involved outcomes carry
  `origin.seeded` while the head's does not.
- `src/runtime/incremental.test.ts` (`INCREMENTAL01`) asserts an edit that lets
  an indirect cycle grow further re-parses to the same value as a fresh parse,
  with no seeded outcome rehydrated.

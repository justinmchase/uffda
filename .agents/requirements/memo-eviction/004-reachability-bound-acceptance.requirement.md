---
id: memo-eviction-004
title: Memo retention is bounded by live reachability rather than a universal constant-memory limit
spec_ref: ".agents/specifications/runtime/memo-eviction.spec.md#core-contract; .agents/specifications/runtime/memo-eviction.spec.md#interaction-with-delivered-results"
---

# Reachability Bound Acceptance

## Requirement

Preconditions:

- Eviction runs while active rule frames, growth loops, and pending alternatives
  may still revisit input.

Expected behavior:

- Completed entries before a proven low-water mark MUST be evicted unless
  protected by a live dependency. Pending and growing entries, active frames,
  and their transitive dependencies MUST remain valid after compaction.
- Nested or multiple input domains that are not comparable under the active
  low-water proof MUST conservatively retain memo state rather than applying
  another domain's cursor.
- Retention measurements MUST distinguish transient memo entries from retained
  input and delivered match graphs. The latter are ordinary reachable values,
  not memo leaks.
- A rule pinned at position zero MAY retain a memo window proportional to the
  input it can still revisit. No universal constant-memory guarantee is made.
- For an N-item fixed flat input parsed by `Main = Atom*`, `Atom = any`, the
  peak memo table MUST contain at most N + 2 entries (Main, each consumed Atom,
  and the terminating failed Atom). After completion it MUST contain zero
  entries, while the delivered result remains readable after collection.
- Sequential completed parses MUST NOT accumulate transient memo state.
- After full collection, repeated parses of this same fixed workload MUST retain
  the same number of GC allocations. This measures retained collector objects,
  not process RSS or all external allocations.

Postconditions:

- Compaction and collection MUST preserve values, diagnostics, rejected
  attempts, and stabilized recursion outcomes.
- Tests: `rust/src/runtime/tests.rs`.

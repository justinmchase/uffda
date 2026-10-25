---
id: runtime-memory-002
title: Unreachable cyclic value graphs are reclaimed
spec_ref: ".agents/specifications/runtime/memory-management.spec.md#roots-and-captures"
---

# Cyclic reclamation

## Requirement

Preconditions:

- A rooted graph contains a self-reference or a cycle between allocations.

Expected behavior:

- Completed collection MUST preserve the graph while rooted.
- Releasing its last root and completing collection MUST reclaim it without
  manually clearing cyclic edges.
- Repeating allocation and completed collection MUST NOT accumulate unreachable
  GC allocations.

Postconditions:

- Tests: `src/gc_tests.rs`.

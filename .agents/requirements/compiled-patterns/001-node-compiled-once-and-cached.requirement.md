---
id: compiled-patterns-001
title: A pattern node is compiled at most once and reused on every subsequent match
spec_ref: ".agents/specifications/runtime/compiled-patterns.spec.md#compilation"
---

# Node Compiled Once And Cached

## Requirement

Preconditions:

- A pattern node is matched against a `Scope` one or more times over the
  lifetime of a process.

Expected behavior:

- The first time a given pattern node object is matched, the runtime MUST
  compile it into a closure and cache that closure keyed by the node's own
  object identity.
- Every subsequent match of that same node object MUST reuse the cached closure
  without recompiling it.
- Two distinct pattern node objects that are structurally identical (same kind
  and same fields) MUST be compiled independently; compiling one MUST NOT
  populate the cache entry for the other.
- Compiling a node MUST NOT read or depend on any particular `Scope`; only the
  node's own declared kind and static fields (for example a nested pattern, a
  list of child patterns, or a fixed character class) MAY be used while building
  its closure.

Error behavior:

- None specific to this requirement; compilation itself MUST NOT be capable of
  failing for any well-formed `Pattern` value.

Postconditions:

- A pattern node's match outcome (success, failure, error, matched value,
  consumed input, and diagnostics) is identical whether it was matched via a
  freshly compiled closure or a cached one.

---
id: compiled-patterns-001
title: A pattern node is compiled at most once and reused on every subsequent match
spec_ref: ".agents/specifications/runtime/compiled-patterns.spec.md#compilation"
---

# Node Compiled Once And Cached

## Requirement

Preconditions:

- A pattern node is matched against a `Scope` one or more times, within one or
  more independently constructed runtime instances.

Expected behavior:

- The first time a given pattern node object is matched by a particular runtime
  instance, that instance MUST compile it into a closure and cache the closure,
  keyed by the node's own object identity, on a per-runtime-instance owner
  (never on process-wide or module-level global state).
- Every subsequent match of that same node object by the same runtime instance
  MUST reuse that instance's cached closure without recompiling it.
- Two distinct pattern node objects that are structurally identical (same kind
  and same fields) MUST be compiled independently; compiling one MUST NOT
  populate the cache entry for the other.
- Two independently constructed runtime instances MUST NOT share a compiled
  closure for the same pattern node object: each instance's first match of that
  node MUST compile and cache its own closure, independent of whether another
  instance has already compiled one for the same node.
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

# Asynchronous input delivery

This chapter refines the [input model](../patterns/input-model.spec.md) for
externally delivered Rust input. It complements
[host execution](host-execution.spec.md) without introducing Promise values.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted as
described in RFC 2119 and RFC 8174 when they appear in all capitals.

## Definitions

- A source is an explicitly identified input producer and a retained ordered
  prefix of delivered runtime values.
- Availability is an item, confirmed EOF, or outstanding external delivery.
- A delivery request identifies the next unavailable position of one source.

## Axioms

- Asynchronous delivery is distinct from editor open-input mode. Unknown
  availability MUST NOT be interpreted as EOF or match failure.
- Items MUST be arbitrary runtime values, not restricted to text or JSON.
- Position identity MUST remain stable as the prefix grows.

## Constraints

- Execution MUST request an item only when a pattern needs its availability. At
  most one delivery per source MUST be outstanding; cached positions MUST NOT
  pull again. No background read-ahead or whole-source precollection is
  permitted.
- EOF MUST be explicit and permanent. Errors MUST be sticky typed failures.
- Backtracking, rule memoization, nested scopes, and collection MUST preserve
  delivered items and the source's identity.
- A delivered prefix MUST NOT be discarded while reachable scopes, matches, memo
  entries, or external roots can observe it. This foundation MAY retain the
  entire delivered prefix; it does not implement memo eviction.
- Futures MUST be polled outside collector scopes and complete by safe arena
  re-entry, as for host calls. Foreign roots and stale requests MUST fail.
- Dropping the external driver MUST release its pending future and cancel
  unfinished execution. Synchronous iterable inputs MUST remain immediate.
- Appending input MUST NOT copy the entire delivered prefix. Immutable snapshots
  retained by matches MUST remain readable without observing later appends.
  Lookup and append SHOULD take logarithmic or better work in prefix length.

## Mechanism

Pattern and rule execution forward a typed external request discriminating host
invocation from input delivery. Completion appends one item or records EOF, then
resumes the suspended pattern frame, without replaying already-completed calls
or rule bodies. Nested Into traversal of an external source uses its own cached
prefix while preserving structural input paths.

## Why this design

Caching delivery once per position preserves ordered choice without repeating
producer side effects. Suspending the exact continuation avoids speculative EOF
results in memo tables. Explicit requests let any host executor provide
backpressure without exporting collector lifetimes.

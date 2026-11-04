---
id: over-002
title: Over matches undeclared Object entries with rest patterns
spec_ref: ".agents/specifications/patterns/runtime/over.spec.md#rest-clauses"
---

# Over Rest Clauses

## Requirement

Preconditions:

- An `over` pattern with rest clauses is evaluated on an Object value.

Expected behavior:

- Rest clauses MUST consider every Object entry not named in its declared key
  map and MUST use the original key value.
- For each remaining property or entry, `over` MUST try rest clauses in source
  order and accept the first clause whose key and value patterns both match.
- A key or value pattern failure MUST let `over` try the next rest clause.
- Variables captured in a rest clause's key or value patterns MUST be
  accumulated into arrays in entry order, containing the corresponding capture
  from each entry claimed by that clause. If no entries are claimed, those
  variables MUST remain unbound.
- A rest clause MAY capture the full claimed entry by name; that binding MUST be
  an array of `[key, value]` pairs in entry order. If no entries are claimed,
  that variable MUST remain unbound.
- `over` MUST NOT apply rest clauses to declared keys or re-match an entry
  accepted by an earlier clause.
- Object entries MUST be processed in insertion order.
- If no rest clause matches an entry, `over` MUST fail unless the final rest
  clause is the catch-all.
- A pattern without rest clauses MUST preserve the existing behavior of ignoring
  undeclared properties or entries.

Postconditions:

- Success MUST preserve the original Object as the output value.
- Tests: `src/pattern/composite_ports.rs`.

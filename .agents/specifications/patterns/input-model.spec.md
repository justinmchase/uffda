# Input model

This chapter defines the input-stream model used by pattern matching.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are
to be interpreted as described in RFC 2119 and RFC 8174.

Pattern matching operates over an ordered input stream of items.

- Runtime implementations MUST support explicit input normalization modes at
  pattern-entry boundaries.
- A **scalar** normalization mode MUST treat the provided value as a single
  input item, even when the value is iterable.
- An **iterable** normalization mode MUST require an iterable value and MUST
  produce an input stream over that iterable's items.
- Runtime implementations MUST use **scalar** normalization mode when one is
  not explicitly specified.

Each input item has value-surface semantics used by runtime patterns:

- A **scalar item** is matched directly as one item value.
- An **iterable item** can be traversed with `into`, which evaluates a child
  pattern against a new input stream created from that iterable's items.
- A **keyed item** (object or `Map`) can be traversed with `over`, which
  evaluates declared keys against nested single-item streams.

Composition and boundary patterns (`then`, `and`, `or`, `not`, `end`, and
related patterns) operate over stream positions regardless of item surface. When
the active stream has one scalar item, a multi-step sequence can only succeed if
later steps are zero-width or delegated to nested traversal (for example, via
`into`).

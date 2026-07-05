# Patterns specification

This chapter defines the top-level contract for Uffda pattern declarations,
matching semantics, and composition rules.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are
to be interpreted as described in RFC 2119 and RFC 8174.

## Subtopics

- [composition as building blocks](./patterns/composition.spec.md)
- [pattern matching](./patterns/pattern-matching.spec.md)
- [direct left recursion](./patterns/direct-left-recursion.spec.md)
- [runtime patterns](./patterns/runtime-patterns.spec.md)

## Input model

Pattern matching operates over an ordered input stream of items.

- Runtime implementations MUST support explicit input normalization modes at
  pattern-entry boundaries.
- A **scalar** normalization mode MUST treat the provided value as a single
  input item, even when the value is iterable.
- An **iterable** normalization mode MUST require an iterable value and MUST
  produce an input stream over that iterable's items.
- Runtime implementations MAY provide a default normalization mode when one is
  not specified.
- If a default normalization mode is provided, that default SHOULD be scalar to
  avoid accidental decomposition of values such as strings into character items.
- Implementations that choose a non-scalar default MUST document that behavior.

Each input item has value-surface semantics used by runtime patterns:

- A **scalar item** is matched directly as one item value.
- An **iterable item** can be traversed with `into`, which evaluates a child
  pattern against a new input stream created from that iterable's items.
- A **keyed item** (object or `Map`) can be traversed with `over`, which
  evaluates declared keys against nested single-item streams.

Composition and boundary patterns (`then`, `and`, `or`, `not`, `end`, and
related patterns) operate over stream positions regardless of item surface.
When the active stream has one scalar item, a multi-step sequence can only
succeed if later steps are zero-width or delegated to nested traversal (for
example, via `into`).

## Open questions and recommended additions

The following patterns are identified as gaps relative to a complete PEG
foundation and general formal grammar expectations. Each is a candidate for
a future runtime pattern subtopic. They are recorded here as open questions
pending decision.

### `literal` — atomic string matching

Matching a multi-character string atomically (e.g., the string `"hello"`)
currently requires `then([equal('h'), equal('e'), equal('l'), equal('l'),
equal('o')])`. This is especially relevant for the expression language layer,
where matching keyword or operator tokens should be a single atomic operation.

A `literal(string)` pattern that decomposes and matches a declared string
atomically would improve ergonomics and produce better match spans and error
messages.

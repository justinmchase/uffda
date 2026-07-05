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

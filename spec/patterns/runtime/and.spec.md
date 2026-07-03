# And pattern

This chapter defines the logical contract for conjunction-based pattern
matching.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are
to be interpreted as described in RFC 2119 and RFC 8174.

## Logical purpose

The `and` pattern represents conjunction over child patterns. It is intended to
express constraints that are all required for a successful match.

## Behavioral expectations

- An `and` pattern MUST evaluate each of its child patterns against the same
  current matching context.
- The `and` pattern MUST succeed only when every child pattern succeeds.
- If any child pattern fails, the `and` pattern MUST fail.
- Implementations SHOULD preserve failure information that helps identify which
  required condition did not hold.

## Composition intent

- The `and` pattern SHOULD be used to combine orthogonal constraints into a
  single, declarative matching rule.
- The `and` pattern MAY be composed with sequencing, alternation, traversal, and
  pipeline-oriented patterns to form larger composite behaviors.
- The `and` pattern is a foundational building block and is intended to
  participate in arbitrarily complex pattern structures.

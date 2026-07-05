# Or pattern

This chapter defines the logical contract for disjunction-based matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `or` pattern represents alternation over child patterns. It succeeds when
any child pattern succeeds.

## Behavioral expectations

- An `or` pattern MUST evaluate its child patterns against the same current
  matching context.
- An `or` pattern MUST try child patterns in declaration order.
- If a child pattern succeeds, the `or` pattern MUST succeed immediately using
  that child pattern's result.
- If a child pattern fails, the `or` pattern MUST continue to the next child
  pattern, if any.
- If every child pattern fails, the `or` pattern MUST fail.
- An `or` pattern with no child patterns MUST fail.
- If any child pattern reports an error, the `or` pattern MUST propagate that
  error immediately.

## Left-recursion behavior

- If any child pattern reports a left-recursion outcome, the `or` pattern MUST
  propagate that outcome unchanged.
- The `or` pattern MUST NOT convert a left-recursion outcome into failure or
  success.
- For direct-left-recursive grammars, recursion that appears in the first
  alternative position of an `or` branch SHOULD be treated as direct left
  recursion (DLR) and evaluated according to
  [runtime left recursion](../../runtime/left-recursion.spec.md).
- Indirect left recursion (ILR) that flows through different rules is not a
  generally supported `or` composition strategy and MUST follow
  [runtime left recursion](../../runtime/left-recursion.spec.md#supported-and-unsupported-forms).

## Input consumption

- An `or` pattern MUST NOT consume input directly.
- When a child pattern succeeds, the `or` pattern MUST consume exactly the
  input consumed by that successful child pattern.
- When a child pattern fails, the `or` pattern MUST continue as though no input
  had been consumed by that failing branch.
- If every child pattern fails, the `or` pattern MUST fail without consuming
  input.

## Expected output

- When a child pattern succeeds, the `or` pattern MUST report that child
  pattern's matched value as its output value.
- When every child pattern fails, the `or` pattern MUST report failure output.

## Error conditions

- The `or` pattern itself does not introduce new error states.

## Side effects

- The `or` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `or` pattern SHOULD be used to express alternatives where any one branch
  may satisfy a grammar rule.
- The `or` pattern MAY be composed with sequencing, conjunction, traversal, and
  boundary assertions to describe branching grammars.

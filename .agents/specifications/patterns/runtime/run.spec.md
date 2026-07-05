# Run pattern

This chapter defines the logical contract for module-entry-point pattern
execution.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `run` pattern executes a named or default exported rule from the scope's
active module, making it the primary mechanism for triggering module-level
grammar evaluation.

## Behavioral expectations

- A `run` pattern MUST inspect the active module in the current
  [scope](../../runtime/scopes.spec.md).
- If a rule name is specified, the `run` pattern MUST look up that name from
  the active module's exports.
- If no rule name is specified, the `run` pattern MUST use the active module's
  default export.
- If the target rule cannot be resolved (named rule not found, or no default
  export exists), the `run` pattern MUST report a pattern-expected error.
- If the target rule is resolved, the `run` pattern MUST evaluate that rule
  in the current scope.
- If rule evaluation succeeds, the `run` pattern MUST succeed.
- If rule evaluation fails, the `run` pattern MUST fail.
- If rule evaluation reports an error, the `run` pattern MUST propagate that
  error.

## Left-recursion behavior

- If rule evaluation reports a left-recursion outcome, the `run` pattern MUST
  propagate that outcome unchanged.
- The `run` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- A `run` pattern MUST NOT consume input directly.
- A `run` pattern MUST consume exactly the input consumed by its resolved rule
  evaluation.
- If rule resolution fails before evaluation, the `run` pattern MUST report an
  error without consuming input.

## Expected output

- On success, the `run` pattern MUST report the resolved rule's matched value
  as its output value.
- On failure, the `run` pattern MUST report failure output.

## Error conditions

- Named rule not found in module exports MUST report a pattern-expected error.
- Missing default export when no name is specified MUST report a
  pattern-expected error.

## Side effects

- The `run` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `run` pattern SHOULD be used as the entry point for evaluating a full
  module grammar against an input stream.
- The `run` pattern is the primary way the `special` pattern and the test
  harness trigger module-level rule execution.
- The `run` pattern MAY be composed with pipeline and traversal patterns when
  module-level execution is used as one stage of a larger matching flow.

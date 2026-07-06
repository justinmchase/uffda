---
id: runtime-core-005
title: Failed and zero-width outcomes preserve caller-visible input position unless explicitly committed
spec_ref: ".agents/specifications/runtime/scopes.spec.md#scope-transitions-during-pattern-matching; .agents/specifications/runtime/scopes.spec.md#pattern-matching-interactions"
---

# Failure and Zero-Width Position Preservation

## Requirement

Preconditions:

- A pattern is evaluated at caller-visible input position P.

Expected behavior:

- If the pattern fails, the caller-visible resulting input position MUST remain
  P unless the caller composes behavior that explicitly commits consumption.
- Zero-width pattern outcomes MUST preserve input position.
- Input-consuming pattern outcomes MUST report updated input position through
  resulting scope.

Composition constraints:

- Nested or derived scopes MAY be used internally.
- Any internal nested evaluation MUST project its position effects back to
  caller-visible scope boundaries according to pattern semantics.

Postconditions:

- Composed matching remains predictable at call boundaries, including failure
  paths and zero-width assertions.

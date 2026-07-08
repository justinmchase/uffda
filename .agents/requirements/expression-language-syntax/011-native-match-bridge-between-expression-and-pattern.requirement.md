---
id: expression-language-syntax-011
title: Expression projection can invoke pattern logic through a native match bridge
spec_ref: ".agents/specifications/languages/expression-layer.spec.md#language-design-goals; .agents/specifications/languages/expression-layer.spec.md#integration-requirements; .agents/specifications/languages/pattern-layer.spec.md#high-level-principles"
---

# Native Match Bridge Between Expression and Pattern

## Requirement

Preconditions:

- Expression projections may need pattern-driven branch selection or
  pattern-shaped argument constraints.

Expected behavior:

- Expression projection MAY invoke pattern logic through a native `match`
  function bridge.
- The bridge MUST preserve deterministic behavior for fixed input and fixed
  visible bindings.
- The bridge MUST preserve diagnostic boundaries between expression projection
  failures and pattern match failures/errors.

Postconditions:

- Expression and pattern layers interoperate without collapsing their distinct
  semantics or introducing statement-like control-flow syntax into expressions.

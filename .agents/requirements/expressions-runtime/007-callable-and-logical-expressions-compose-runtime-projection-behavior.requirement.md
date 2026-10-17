---
id: expressions-runtime-007
title: Callable, lambda, native, spread, and unary expressions compose runtime projection behavior
spec_ref: ".agents/specifications/expressions/invocation.spec.md#behavioral-expectations; .agents/specifications/expressions/lambda.spec.md#behavioral-expectations; .agents/specifications/expressions/native.spec.md#logical-purpose; .agents/specifications/expressions/array-spread.spec.md#behavioral-expectations; .agents/specifications/expressions/object-spread.spec.md#behavioral-expectations; .agents/specifications/expressions/not.spec.md#behavioral-expectations; .agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary"
---

# Callable and Logical Projection Composition

## Requirement

Preconditions:

- The runtime evaluates an invocation, lambda, native, spread-enabled aggregate,
  or unary expression.

Expected behavior:

- Invocation expressions MUST evaluate their target and arguments in order and
  call the resulting callable value.
- Lambda expressions MUST match invocation arguments against their pattern and
  then evaluate the lambda body in the resulting scope.
- In the TypeScript runtime, native expressions MAY execute host-language
  callables and return their result directly. The Rust runtime MUST reject
  native-JavaScript expression ASTs; Rust-native globals remain in scope through
  ordinary invocation.
- Array and object expressions using spread initializers MUST preserve
  declaration-order composition and host spread semantics.
- Unary not expressions MUST apply logical negation semantics to their operand.
- Rust callable results MUST be normalized by execution, not represented as
  first-class Promise values. Native and authored JSON hooks/iterator factories
  MUST use completed invocation results rather than JavaScript Promise-shaped
  placeholders.

Error behavior:

- Child-expression errors MUST propagate unchanged.
- Non-callable invocation targets MUST report the governed invocation error.
- A standalone host driver that cannot service a requested rule reference MUST
  report an unknown-reference error instead of repeatedly yielding forever.

Postconditions:

- Tests: `rust/src/evaluate/tests.rs`.

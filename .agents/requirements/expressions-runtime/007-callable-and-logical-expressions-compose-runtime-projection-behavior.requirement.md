---
id: expressions-runtime-007
title: Callable, lambda, native, binary, and unary expressions compose runtime projection behavior
spec_ref: ".agents/specifications/expressions/invocation.spec.md#behavioral-expectations; .agents/specifications/expressions/lambda.spec.md#behavioral-expectations; .agents/specifications/expressions/native.spec.md#logical-purpose; .agents/specifications/expressions/binary.spec.md#behavioral-expectations; .agents/specifications/expressions/not.spec.md#behavioral-expectations"
---

# Callable and Logical Projection Composition

## Requirement

Preconditions:

- The runtime evaluates an invocation, lambda, native, binary, or unary
  expression.

Expected behavior:

- Invocation expressions MUST evaluate their target and arguments in order and
  call the resulting callable value.
- Lambda expressions MUST match invocation arguments against their pattern and
  then evaluate the lambda body in the resulting scope.
- Native expressions MAY execute host-language callables and return their result
  directly.
- Binary expressions MUST apply declared logical operator semantics to their
  evaluated operands.
- Unary not expressions MUST apply logical negation semantics to their operand.

Error behavior:

- Child-expression errors MUST propagate unchanged.
- Non-callable invocation targets MUST report the governed invocation error.

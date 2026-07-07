---
id: expressions-runtime-003
title: Literal expressions evaluate to their declared values without consulting runtime scope
spec_ref: ".agents/specifications/expressions/number.spec.md#behavioral-expectations; .agents/specifications/expressions/boolean.spec.md#behavioral-expectations; .agents/specifications/expressions/value.spec.md#behavioral-expectations"
---

# Literal Expression Evaluation

## Requirement

Preconditions:

- The runtime evaluates a number, boolean, or serializable value expression.

Expected behavior:

- The runtime MUST return the expression's declared value.
- The runtime MUST NOT depend on runtime scope values for evaluation.
- The runtime MUST NOT introduce additional evaluation errors for these literal
  expression kinds.

Postconditions:

- Literal expression evaluation is deterministic for a fixed expression tree.

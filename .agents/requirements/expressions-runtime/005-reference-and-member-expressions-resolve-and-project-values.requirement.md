---
id: expressions-runtime-005
title: Reference and member expressions resolve scope values and project object properties
spec_ref: ".agents/specifications/expressions/reference.spec.md#behavioral-expectations; .agents/specifications/expressions/member.spec.md#behavioral-expectations"
---

# Reference and Member Expression Resolution

## Requirement

Preconditions:

- The runtime evaluates a reference or member expression.

Expected behavior:

- A reference expression MUST resolve its declared name from runtime scope.
- A reference expression MUST respect local match variables before runtime
  capabilities when both are available.
- A member expression MUST evaluate its base expression before projecting a
  property.
- A member expression MUST read the declared property name from the evaluated
  base value.

Error behavior:

- Unresolved references MUST report the governed reference error outcome.
- Child-expression errors MUST propagate unchanged.

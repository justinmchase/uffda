---
id: expressions-runtime-006
title: Array and object expressions compose child values in declaration order
spec_ref: ".agents/specifications/expressions/array.spec.md#behavioral-expectations; .agents/specifications/expressions/object.spec.md#behavioral-expectations; .agents/specifications/expressions/array-element.spec.md#behavioral-expectations; .agents/specifications/expressions/array-spread.spec.md#behavioral-expectations; .agents/specifications/expressions/object-key.spec.md#behavioral-expectations; .agents/specifications/expressions/object-spread.spec.md#behavioral-expectations"
---

# Array and Object Composition

## Requirement

Preconditions:

- The runtime evaluates an array or object expression containing one or more
  initializer entries.

Expected behavior:

- Array initializer entries MUST evaluate in declaration order.
- Array element initializers MUST append one evaluated value.
- Array spread initializers MUST expand evaluated iterable values into the
  resulting array.
- Object key initializers MUST assign the evaluated value to the declared key.
- Object spread initializers MUST merge evaluated object properties into the
  resulting object.

Error behavior:

- Child-expression errors MUST propagate unchanged.
- Non-spreadable child values MUST report runtime spread errors according to the
  host runtime behavior.

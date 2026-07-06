---
id: variable-001
title: Variable binds child output under declared variable name
spec_ref: ".agents/specifications/patterns/runtime/variable.spec.md"
---

# Variable Core Semantics

## Requirement

Preconditions:

- Variable pattern declares binding name N and child pattern C.

Expected behavior:

- Variable MUST evaluate child pattern C.
- On child success, variable MUST bind child output value under name N.
- Variable MUST consume exactly what child consumes and no more.
- On child failure, variable MUST fail without introducing new binding.

Postconditions:

- Success scope MUST include binding N with child output value.

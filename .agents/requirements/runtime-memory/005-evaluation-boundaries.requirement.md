---
id: runtime-memory-005
title: Expression evaluation state survives collection between execution steps
spec_ref: ".agents/specifications/runtime/memory-management.spec.md#mechanism; .agents/specifications/runtime/memory-management.spec.md#roots-and-captures"
---

# Evaluation collection boundaries

## Requirement

Preconditions:

- The runtime evaluates expressions in resumable execution steps.

Expected behavior:

- Collection between steps MUST preserve pending operands, lexical bindings, and
  constructed child values.
- The result MUST equal evaluation without intermediate collection.
- Child failures MUST remain failures when execution is resumed.
- Retained completed results MUST survive collection and MUST NOT be accessible
  through another runtime's root set.
- Nested aggregate execution MUST use explicit execution state rather than
  recursively evaluating children on the host call stack.
- Failure or abandonment MUST release pending syntax and intermediate values
  without recursively dropping deeply nested pending syntax on the host stack.

Postconditions:

- Tests: `rust/src/evaluate/tests.rs`.
- These tests do not establish async invocation or full expression parity.

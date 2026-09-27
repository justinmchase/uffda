---
id: runtime-core-008
title: Fresh rule evaluation begins asynchronously so host stack depth does not grow with input nesting
spec_ref: ".agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary"
---

# Rule Boundary Bounds Stack Depth

## Requirement

Preconditions:

- A rule is invoked at an input position where it has no memoized result.

Expected behavior:

- The invocation MUST return a promise, and the rule body MUST NOT begin
  evaluating until a later microtask, even when every pattern in the body could
  complete synchronously.
- A directly recursive grammar (for example `P = "(" P ")" | "x"`) MUST match
  input nested thousands of levels deep without exhausting the host call stack.

Postconditions:

- Host call stack depth is bounded by the patterns of a single rule body rather
  than by the nesting depth of the input.

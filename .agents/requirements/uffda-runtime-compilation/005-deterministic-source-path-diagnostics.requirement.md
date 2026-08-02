---
id: uffda-runtime-compilation-005
title: Compiler failures identify their rule and source AST path
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#diagnostics-and-provenance"
---

# Deterministic Source Path Diagnostics

## Requirement

Preconditions:

- The runtime compiler receives a fixed structured Uffda syntax tree.
- A compiler rule cannot transform a syntax node in that tree.

Expected behavior:

- The failed compiler match MUST expose a diagnostic naming the compiler rule
  that rejected the node.
- The diagnostic MUST expose the runtime input path of that source AST node.
- Repeating compilation with the same syntax tree and compiler configuration
  MUST produce an equal diagnostic.

Postconditions:

- Callers can locate deterministic compiler failures without traversing or
  redispatching the syntax tree in host code.

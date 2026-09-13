---
id: compiled-patterns-002
title: Pattern kinds without a compiled implementation fall back to the generic interpreter
spec_ref: ".agents/specifications/runtime/compiled-patterns.spec.md#scope"
---

# Uncompiled Kinds Fall Back To The Interpreter

## Requirement

Preconditions:

- A pattern node's kind has no compiled (closure-based) implementation.

Expected behavior:

- Matching such a node MUST dispatch to the generic, kind-by-kind interpreter,
  exactly as it would if compiled dispatch did not exist.
- A composite pattern node that does have a compiled implementation (for
  example, one that matches a sequence or a first-match alternation of child
  patterns) MUST dispatch each of its child pattern nodes through the same
  compile-or-interpret decision, so a compiled parent MAY contain interpreted
  children without any loss of correctness.
- Extending compiled coverage to additional pattern kinds over time MUST NOT be
  treated as an observable behavior change: a grammar's parse results MUST be
  identical before and after a given kind gains a compiled implementation.

Error behavior:

- None specific to this requirement.

Postconditions:

- A pattern tree containing an arbitrary mix of compiled and interpreted node
  kinds produces the same match results as a pattern tree matched entirely
  through the generic interpreter.

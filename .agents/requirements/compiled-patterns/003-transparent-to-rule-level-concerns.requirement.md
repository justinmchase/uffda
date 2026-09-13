---
id: compiled-patterns-003
title: Compiled dispatch does not change rule-level memoization, left recursion, or incremental re-parsing
spec_ref: ".agents/specifications/runtime/compiled-patterns.spec.md#interactions"
---

# Compiled Dispatch Is Transparent To Rule-Level Concerns

## Requirement

Preconditions:

- A rule's pattern tree contains one or more compiled pattern nodes.

Expected behavior:

- A compiled node's match result MUST reference the same pattern node object an
  interpreted match of that node would have, so that any diagnostic or
  `MatchOrigin` referencing a pattern node is unaffected by whether the node was
  matched via a compiled closure or the generic interpreter.
- Rule-level packrat memoization (see
  [runtime selective memoization](../../specifications/runtime/selective-memoization.spec.md)),
  left-recursion growth (see
  [runtime left recursion](../../specifications/runtime/left-recursion.spec.md)),
  and incremental re-parsing's origin-tagging and rehydration (see
  [runtime incremental re-parsing](../../specifications/runtime/incremental-parsing.spec.md))
  MUST behave identically regardless of whether any pattern node within the
  matched rule was compiled.

Error behavior:

- None specific to this requirement.

Postconditions:

- A full grammar's parse result (including diagnostics, memoized reuse, and
  incremental re-parse rehydration) is unaffected by the introduction or
  extension of compiled pattern dispatch.

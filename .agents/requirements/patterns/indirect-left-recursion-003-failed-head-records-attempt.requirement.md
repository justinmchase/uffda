---
id: indirect-left-recursion-003
title: A left-recursive head that never grows records its failed attempt
spec_ref: ".agents/specifications/runtime/left-recursion.spec.md; .agents/specifications/languages/cli/editor-metadata.spec.md#walking-the-parse"
---

# Failed Head Records Its Attempt

## Requirement

Preconditions:

- A left-recursive cycle head receives its own left-recursion outcome and begins
  growth, and the first growth iteration fails.

Expected behavior:

- The head's failure MUST record that first iteration's failed attempt as a
  child, so the sub-matches it accumulated before failing remain reachable from
  the delivered result.
- Once a seed has succeeded, later superseded or non-progressing iterations MUST
  NOT be recorded.

Postconditions:

- For `A = B "x" | "a" "b" "c"; B = A "y"` over `ab`, the rightmost failure
  reachable from the head's failure starts at offset 2, after the partial
  `"a" "b"` progress.
- Diagnostics and completion for incomplete input inside a left-recursive cycle
  (for example an unterminated array in an expression) point at the furthest
  progress, as they do outside of left recursion.

## Test plan

- `src/requirements/patterns/indirect-left-recursion-003-failed-head-records-attempt.requirement.test.ts`
- `src/runtime/rule.test.ts` covers the head failure's children at the runtime
  level.

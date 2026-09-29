---
id: error-recovery-004
title: Recovery is bounded, non-cascading, and invisible to predicates
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#bounded-non-cascading-recovery"
---

# Bounded Recovery and Predicates

## Requirement

Preconditions:

- Patterns are evaluated with recovery enabled.

Expected behavior:

- A recovery MUST consume at least one item; a skip pattern succeeding without
  consumption MUST make the recover pattern fail.
- A skip pattern MUST be evaluated with recovery disabled.
- The child of not and lookahead, and the asserted pattern of except, MUST be
  evaluated with recovery disabled (see
  `.agents/specifications/runtime/error-recovery.spec.md#predicates`).
- A predicate's resulting context MUST carry the recovery setting it was invoked
  with.

Postconditions:

- The number of recoveries in one phase MUST NOT exceed the number of input
  items.

## Test plan

`src/runtime/patterns/recover.test.ts`: RECOVER04, RECOVER05.
`src/runtime/patterns/not.test.ts` (NOT_RECOVERY),
`src/runtime/patterns/lookahead.test.ts` (LOOKAHEAD_RECOVERY),
`src/runtime/patterns/except.test.ts` (EXCEPT_RECOVERY).

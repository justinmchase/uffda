---
id: error-recovery-007
title: Recoveries of the accepted parse are collected in document order
spec_ref: ".agents/specifications/runtime/error-recovery.spec.md#collecting-recoveries"
---

# Collecting Recoveries

## Requirement

Preconditions:

- A match graph, whose root is `Ok` or `Fail`, produced with recovery enabled.

Expected behavior:

- The runtime MUST return every recovery reachable through the accepted parse
  (`Ok` beneath `Ok`, and everything beneath a `Fail` root), each paired with
  the failure it replaced.
- Recoveries MUST be returned in document order, each once, even when shared by
  several paths.
- Recoveries inside rejected attempts beneath an `Ok` MUST NOT be returned.
- Collection MUST NOT mutate the match graph.

Postconditions:

- A match without recoveries MUST yield an empty list.

## Test plan

`src/runtime/recovery.test.ts`: none for a clean parse (RECOVERY00), one with
its failure (RECOVERY01), several in document order (RECOVERY02), beneath a
failed recovery phase (RECOVERY03), none inside a rejected `or` alternative
(RECOVERY06).

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
  (successes beneath successes, and everything beneath a `Fail` root), each
  paired with the failure it replaced.
- A match produced with recovery disabled MUST yield no recoveries.
- Recoveries MUST be returned in document order, each once, even when shared by
  several paths.
- Recoveries inside rejected attempts beneath an `Ok` MUST NOT be returned.
- Collection MUST NOT mutate the match graph.

Postconditions:

- A match without recoveries MUST yield an empty list.

## Test plan

`src/runtime/engine_ports.rs`
(`engine_port_statement_recovery_collects_only_the_accepted_phase`): none for a
clean parse, one with its failure, several in document order, beneath a failed
recovery phase, and none inside a rejected `or` alternative. A match produced
with recovery disabled yields none.

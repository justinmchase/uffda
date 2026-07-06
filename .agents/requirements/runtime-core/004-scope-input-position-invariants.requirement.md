---
id: runtime-core-004
title: Runtime scope carries active input position and transitions immutably
spec_ref: ".agents/specifications/runtime/scopes.spec.md#scope-model; .agents/specifications/runtime/scopes.spec.md#scope-transitions-during-pattern-matching"
---

# Scope Input Position Invariants

## Requirement

Preconditions:

- A pattern is evaluated with an incoming runtime scope.

Expected behavior:

- The incoming runtime scope MUST include an active input stream position.
- Pattern evaluation MUST treat incoming scope as immutable input.
- Pattern evaluation MUST produce a resulting scope representing the match
  outcome.
- Successful patterns MAY advance input position in the resulting scope
  according to pattern semantics.

Postconditions:

- Caller-visible scope state MUST be derived from the produced resulting scope,
  not from in-place mutation of the incoming scope.

---
id: runtime-memory-003
title: Retained captures survive collection and roots remain isolated
spec_ref: ".agents/specifications/runtime/memory-management.spec.md#roots-and-captures"
---

# Retained captures

## Requirement

Preconditions:

- A retained handle references a value or a captured environment graph.

Expected behavior:

- Completed collection MUST preserve the captured bindings and their ancestors.
- A retained handle MUST keep its value alive outside an allocation callback.
- A handle retained across a pending future MUST keep its value alive until the
  future resumes or releases the handle.
- Fetching a retained handle through another runtime's root set MUST fail.
- Releasing the last retained handle MUST allow subsequent reclamation.

Postconditions:

- Tests: `rust/src/gc_tests.rs`.
- These tests establish storage lifetime, not execution or async parity.

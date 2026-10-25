---
id: runtime-memory-004
title: Lexical lookup distinguishes missing bindings and undefined values
spec_ref: ".agents/specifications/runtime/memory-management.spec.md#roots-and-captures"
---

# Lexical bindings

## Requirement

Expected behavior:

- Lookup MUST use the nearest lexical binding.
- A child's binding MUST NOT overwrite the parent's binding.
- An explicitly undefined value MUST shadow an ancestor's defined value.
- A missing binding MUST be represented separately from an undefined value.
- A derived environment MUST share, not copy, its lexical ancestor.

Postconditions:

- Tests: `src/environment.rs`.

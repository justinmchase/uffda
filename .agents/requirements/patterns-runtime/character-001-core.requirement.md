---
id: character-001
title: Character matches one string item against the declared character class
spec_ref: ".agents/specifications/patterns/runtime/character.spec.md"
---

# Character Core Semantics

## Requirement

Preconditions:

- Character pattern is evaluated at position P with a declared character class.

Expected behavior:

- Character MUST inspect at most one input item at P.
- Character MUST require a string input item for class evaluation.
- Character MUST consume exactly one item on success.
- Character MUST fail without consumption on class mismatch or end-of-input.

Postconditions:

- Success output MUST be the consumed character item.

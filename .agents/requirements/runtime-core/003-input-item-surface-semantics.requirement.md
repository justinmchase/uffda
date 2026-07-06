---
id: runtime-core-003
title: Input item surfaces define traversal behavior for scalar, iterable, and keyed values
spec_ref: ".agents/specifications/patterns/input-model.spec.md#input-model"
---

# Input Item Surface Semantics

## Requirement

Preconditions:

- A runtime input stream is active.
- A pattern evaluates at a specific stream position.

Expected behavior:

- A scalar item MUST be matched as one direct item value.
- An iterable item MUST be traversable only through nested traversal behavior
  that evaluates a child pattern against a new stream from iterable items.
- A keyed item (object or Map) MUST be traversable only through keyed traversal
  behavior that evaluates declared keys against nested single-item streams.

Composition constraints:

- Position-based composition and boundary patterns MUST operate over stream
  positions regardless of item surface.
- When the active stream has one scalar item, multi-step sequential composition
  MUST only succeed when later steps are zero-width or delegated to nested
  traversal.

Postconditions:

- Stream-position behavior remains consistent across item surfaces while
  enabling explicit nested traversal semantics.

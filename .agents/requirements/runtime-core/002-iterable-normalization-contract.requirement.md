---
id: runtime-core-002
title: Iterable normalization requires iterable input and materializes stream items in iterable order
spec_ref: ".agents/specifications/patterns/input-model.spec.md#normalization-modes"
---

# Iterable Normalization Contract

## Requirement

Preconditions:

- Pattern evaluation begins at a pattern-entry boundary.
- The caller explicitly selects iterable normalization mode.

Expected behavior:

- The runtime MUST require that the provided input value is iterable.
- The runtime MUST construct the active input stream from that iterable's items.
- The constructed stream MUST preserve iterable item order.

Error behavior:

- If iterable normalization mode is selected for a non-iterable input value, the
  runtime MUST raise an explicit error.

Postconditions:

- Patterns evaluating against the resulting stream MUST observe item boundaries
  based on iterable elements, not scalar wrapping.

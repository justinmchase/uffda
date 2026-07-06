---
id: runtime-core-001
title: Runtime defaults to scalar normalization and rejects unknown normalization modes
spec_ref: ".agents/specifications/patterns/input-model.spec.md#normalization-modes"
---

# Default Scalar Normalization

## Requirement

Preconditions:

- Pattern evaluation begins at a pattern-entry boundary.
- The caller provides an input value.
- The caller may omit normalization mode.

Expected behavior:

- The runtime MUST support explicit normalization mode selection at
  pattern-entry boundaries.
- If normalization mode is omitted, the runtime MUST use scalar normalization
  mode.
- Scalar normalization mode MUST treat the provided value as exactly one input
  item, including when that value is iterable.

Error behavior:

- If the caller specifies a normalization mode other than scalar or iterable,
  the runtime MUST raise an explicit error.

Postconditions:

- The resulting input stream shape MUST be deterministic from the selected (or
  defaulted) normalization mode.

---
id: pipeline-002
title: Pipeline drains lazily produced generator values at stage boundaries
spec_ref: ".agents/specifications/patterns/runtime/pipeline.spec.md#lazy-sequence-draining-at-stage-boundaries"
---

# Pipeline Lazy Sequence Draining

## Requirement

Preconditions:

- A `pipeline` pattern step succeeds with a matched value that is an actual
  generator or async-generator instance (for example, the result of a std
  `enumerate`/`map`/`filter` call composed inside that step's projection),
  rather than an already-materialized array.

Expected behavior:

- Before building the next step's derived input stream, the `pipeline` pattern
  MUST drain the generator instance into a concrete array.
- Before computing source provenance for that step, the `pipeline` pattern MUST
  use the drained array, not the original generator instance.
- The step's reported match value MUST also reflect the drained array (for
  example, in diagnostic/visualization output), not the original, now-exhausted
  generator instance.
- This draining MUST NOT be applied to values that merely implement
  `Symbol.iterator`/`Symbol.asyncIterator` without being an actual
  generator/async-generator instance. A plain domain object that exposes an
  iterator protocol for downstream stream consumption (for example, a
  source-document record) MUST pass through a pipeline stage unchanged.
- Values that are already arrays, or that are not iterable at all, MUST pass
  through a pipeline stage unchanged.

Postconditions:

- Downstream stages, and any caller inspecting a pipeline's per-stage match
  values, observe a concrete array wherever a step produced a lazily produced
  sequence — never an opaque, already-exhausted generator object.

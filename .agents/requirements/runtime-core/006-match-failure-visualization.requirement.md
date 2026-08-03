---
id: runtime-core-006
title: Match failures have deterministic human-readable visualizations
spec_ref: ".agents/specifications/runtime/match-diagnostics.spec.md#diagnostic-model"
---

# Match Failure Visualization

## Requirement

Preconditions:

- A runtime match result is available.
- The result MAY contain shared or cyclic match references.

Expected behavior:

- `visualizeMatchFailure` MUST return deterministic plain text.
- A failed expression-language parse of `(add 1 #)` MUST identify `#` as the
  unexpected input.
- The visualization MUST name the failing pattern hierarchy and its governing
  module.
- The expression-language pipeline MUST identify tokenization as successful,
  include its `(`, `add`, and `1` output, and identify expression parsing as the
  failed step.
- Rendering MUST terminate when the match graph contains a cycle.

Postconditions:

- The diagnostic can be printed to a console or file without another rendering
  dependency.

---
id: cli-workbench-002
title: CLI workbench renders compilation and match inspection output
spec_ref: ".agents/specifications/languages/cli/interactive-workbench.spec.md#dynamic-visualization"
---

# Workbench Visualization

## Requirement

Preconditions:

- An active workbench session has a current compilation result.

Expected behavior:

- The `visualize` action MUST attach text-first inspection output to the
  response session state.
- Successful compilation visualization MUST include language, source provenance,
  and the current AST.
- Failed compilation visualization MUST include language, source provenance,
  phase, and diagnostic message.
- The `match` action MUST accept input only for a valid pattern-language
  session, and its failure visualization MUST use the runtime match renderer.
- Visualization failures MUST preserve the current editable session state.

Postconditions:

- Interactive and automated operators can inspect compile and match outcomes
  without relying on a rich terminal UI.

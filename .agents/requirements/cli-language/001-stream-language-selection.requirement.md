---
id: cli-language-001
title: CLI parse command parses the selected language
spec_ref: ".agents/specifications/languages/cli/language-and-output.spec.md#language-mode-selection"
---

# Parse Command Language Selection

## Requirement

Preconditions:

- The `parse` command is selected with an optional `--lang` value.

Expected behavior:

- With no language flag, the parse command MUST parse full Uffda source and emit
  its raw module AST.
- With `--lang pattern`, the parse command MUST parse pattern source and emit
  its raw pattern AST.
- With `--lang expression`, the parse command MUST parse expression source and
  emit its raw expression AST.
- Parse diagnostics MUST identify the selected language.

Postconditions:

- Operators can use one parse command for full Uffda, pattern, and expression
  parsing without changing the input transport.

---
id: cli-command-model-002
title: CLI mode precedence and conflict handling are deterministic
spec_ref: ".agents/specifications/languages/cli/command-model.spec.md#mode-selection-precedence-contract"
---

# CLI Mode Precedence and Conflicts

## Requirement

Preconditions:

- A CLI invocation may provide command names, explicit mode flags, and
  standard-input context.

Expected behavior:

- Mode resolution MUST be deterministic.
- Conflicting command and mode selection MUST fail with deterministic usage
  diagnostics.
- In the absence of an explicit command, mode flag, or any argument, the CLI
  MUST default to the interactive workbench.
- In the absence of an explicit command or mode flag when other arguments are
  present (for example a source path), deterministic fallback policy MUST choose
  compile mode regardless of standard-input attachment.

Postconditions:

- Invocation behavior remains predictable across interactive use and automation.

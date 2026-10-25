---
id: cli-command-model-004
title: Preview CLI validation fixtures match the reference and relocated commands use embedded languages
spec_ref: ".agents/specifications/languages/cli/command-model.spec.md#error-shape-contract; .agents/specifications/languages/cli/command-model.spec.md#input-selection-contract"
---

# Shared Validation and Installed Command Acceptance

## Requirement

Preconditions:

- The Rust preview and reference CLI receive a common validation fixture from
  `tests/rust/cli-validation-fixtures.json`.
- A built Rust binary is copied outside the checkout into a directory with no
  project configuration or compiled language artifacts and no runtime tools on
  `PATH`.

Expected behavior:

- Each validation fixture MUST produce exit code 2, empty stdout, and the exact
  specified JSON diagnostic object, including code, phase, and message.
- `parse` and `match` MUST reject `--config` as usage before attempting to open
  the named configuration. `--check` MUST be rejected outside `fmt`.
- The relocated binary MUST execute all six supported commands using embedded
  language artifacts. Compile MAY write the requested user project artifacts;
  subsequent commands MUST NOT depend on that generated artifact directory.
- Source execution, AST execution, successful JSON output, match failure,
  formatting/check, and compile artifacts MUST be verified where applicable.

Postconditions:

- These fixtures establish the covered validation combinations and installed
  command paths, not exhaustive parity for every flag combination.
- Tests: `src/cli.rs`
  (`reference_validation_fixtures_preserve_exact_diagnostic_objects`), and
  `tests/cli.rs`.

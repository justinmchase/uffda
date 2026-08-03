---
id: cli-compile-004
title: CLI compile emits raw syntax AST JSON
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# Raw Syntax AST Emission

## Requirement

Preconditions:

- Compile mode has parsed a Uffda source unit into a syntax AST.

Expected behavior:

- The emitted JSON file MUST be the parsed syntax AST itself.
- The emitted AST MUST NOT contain CLI-specific compiler, module identity,
  version, or source-path metadata.
- Source-path provenance MUST remain available through the compile result and
  failure diagnostics.

Postconditions:

- Operators can persist or inspect the language AST without a CLI-defined
  transport wrapper.

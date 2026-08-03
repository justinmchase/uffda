---
id: cli-compile-005
title: CLI parse command parses one source unit to one AST payload
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#stream-contracts"
---

# Parse Command Standard Input and Output AST Parsing

## Requirement

Preconditions:

- The `parse` command is selected without positional file or folder paths.
- Standard input supplies one Uffda source unit, which may be empty.

Expected behavior:

- Valid input MUST emit exactly one raw syntax AST JSON payload to standard
  output and no diagnostic payload to standard error.
- Invalid input MUST emit exactly one deterministic parse diagnostic JSON
  payload to standard error and no primary payload to standard output.
- Empty full-Uffda input MUST succeed by emitting an empty Uffda module AST.

Postconditions:

- Pipelines can parse one source unit without writing intermediate source or AST
  files.

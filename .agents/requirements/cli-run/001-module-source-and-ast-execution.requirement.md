---
id: cli-run-001
title: CLI run executes one Uffda module source or raw module AST
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Module Execution

## Requirement

Preconditions:

- The `run` command receives Uffda module source from one path, standard input,
  or `-e`/`--eval`; alternatively, it receives one module AST JSON payload when
  `--ast` is supplied.
- The invocation may supply `--entry <rule>`.

Expected behavior:

- Uffda module source MUST parse and compile before execution.
- A raw module AST MUST be accepted only when `--ast` is supplied.
- `--entry` MUST select an exported rule; without it, the command MUST select
  the first exported rule.
- String results MUST be written as text to standard output; other defined
  results MUST be written as JSON.
- Parse, unsupported-AST, compilation, and runtime failures MUST produce
  deterministic diagnostics on standard error and a non-zero exit code.

Postconditions:

- Operators can run Uffda modules directly from source or compose a
  `parse
  --lang uffda` AST pipeline without an artifact wrapper.

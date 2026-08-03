---
id: cli-exec-001
title: CLI exec evaluates one expression source or raw expression AST
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Expression Execution

## Requirement

Preconditions:

- The `exec` command receives expression source from one path, standard input,
  or `-e`/`--eval`; alternatively, it receives one expression AST JSON payload
  when `--ast` is supplied.

Expected behavior:

- Expression source MUST parse before execution.
- A raw expression AST MUST execute as an implicit `Main` rule.
- The CLI MUST provide `echo` to expression execution as an identity function.
- String results MUST be written as text to standard output; other defined
  results MUST be written as JSON.
- Invalid JSON and runtime failures MUST produce deterministic diagnostics on
  standard error and a non-zero exit code.

Postconditions:

- Expressions can execute directly while parser-to-executor pipelines can pass
  raw expression AST JSON without a CLI artifact wrapper.

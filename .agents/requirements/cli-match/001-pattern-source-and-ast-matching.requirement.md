---
id: cli-match-001
title: CLI match applies one pattern source or raw pattern AST to explicit input
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Pattern Matching

## Requirement

Preconditions:

- The `match` command receives pattern source from one path, standard input, or
  `-e`/`--eval`; alternatively, it receives one pattern AST JSON payload when
  `--ast` is supplied.
- The invocation supplies match subject text with `--input`, a JSON subject with
  `--input-json`, a subject path with `--input-file`, or a codec data subject
  with `--input-data` / `--input-data-file`.
- The invocation may supply `--json` to request machine-readable output and
  diagnostics.

Expected behavior:

- Pattern source MUST parse before matching.
- A raw pattern AST MUST be accepted only when `--ast` is supplied.
- The command MUST reject invocations that combine or repeat subject options.
- `--input` and `--input-file` subjects MUST be treated as text. `--input-json`
  MUST parse as one JSON value before matching.
- A successful match MUST emit its value as one compact data codec record
  followed by LF unless `--json` explicitly selects JSON value output. Strings
  MUST be quoted in default output.
- Parse, JSON-decoding, input-read, unsupported-AST, and match failures MUST
  produce deterministic diagnostics on standard error and a non-zero exit code.
- Match failures without `--json` MUST include the rightmost failed pattern,
  input position, and source excerpt with a caret when source is available.

Postconditions:

- Operators can match directly from pattern source or compose a
  `parse --lang
pattern` AST pipeline without an artifact wrapper.

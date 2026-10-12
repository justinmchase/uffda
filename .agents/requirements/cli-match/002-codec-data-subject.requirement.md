---
id: cli-match-002
title: CLI match decodes one explicit codec data subject
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Codec data matching

## Requirement

Preconditions:

- `match` receives pattern source or an explicit `--ast` pattern JSON.
- `--input-data <source>` or `--input-data-file <path>` selects the subject.

Expected behavior:

- The command MUST decode exactly one Uffda data codec record, accepting
  surrounding comments and blank lines and multiline containers.
- Decoding MUST NOT evaluate expressions or interpolate quoted strings.
- All fixed codec-native values MUST materialize in the runtime collector arena
  and match as one scalar value, not iterable input.
- Empty, malformed, executable, duplicate-key, unknown-tag, and multiple-record
  subjects MUST fail with nonzero status, no result output and an input-phase
  diagnostic. Subject file-read errors MUST fail explicitly.
- Subject modes (`--input`, `--input-file`, `--input-json`, `--input-data`,
  `--input-data-file`) MUST be mutually exclusive, including repeated options.
  Inline `--input-data=value` MUST work. Missing option values MUST fail.
- Codec subject options MUST NOT be accepted by `exec`, `parse`, `compile` or
  `fmt`. They MUST remain independent of program `--ast`.
- Default codec output MUST round-trip through the codec subject mode; `--json`
  MUST retain JSON serialization behavior, including rejection of BigInt.

Postconditions:

- Tests: `rust/tests/cli_data.rs` and `rust/src/runtime/tests.rs`.

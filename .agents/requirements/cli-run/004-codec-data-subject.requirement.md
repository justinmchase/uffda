---
id: cli-run-004
title: CLI run decodes one explicit codec data subject
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Codec data module subject

## Requirement

Preconditions:

- `run` receives Uffda module source or an explicit `--ast` module syntax JSON.
- `--input-data <source>` or `--input-data-file <path>` selects the subject.

Expected behavior:

- The selected exported rule MUST receive exactly one decoded codec data value,
  including native tags, arrays, strings and undefined, as scalar input.
- Decoding MUST materialize genuine runtime-native values in the collector arena
  without expression evaluation or an intermediate JSON conversion.
- Comments and multiline containers MUST be accepted. Empty, malformed,
  executable or multiple-record data MUST fail with nonzero status, no result
  output and an input-phase diagnostic. File-read errors MUST fail explicitly.
- Codec modes MUST be mutually exclusive with each other and all text/JSON
  subject options, including repeated options. Program `--ast` MUST remain
  independent of subject decoding.
- Default codec result output MUST round-trip through these subject options;
  `--json` MUST retain explicit JSON serialization behavior.
- Without a subject option, `run` MUST continue matching empty input.
- Compiled declaration artifacts and bootstrap MUST remain JSON and unchanged.

Postconditions:

- Tests: `rust/tests/cli_data.rs` and `rust/src/runtime/tests.rs`.

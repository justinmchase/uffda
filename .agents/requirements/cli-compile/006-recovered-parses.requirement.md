---
id: cli-compile-006
title: Parse and compile report every parse diagnostic, and treat recovered parses as failures
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#parse-contracts"
---

# Recovered Parses in Parse and Compile

## Requirement

Preconditions:

- `uffda parse` or `uffda compile` parses a source.

Expected behavior:

- A parse diagnostic payload MUST carry a `diagnostics` list of every parse
  diagnostic in document order (one `CLI_STREAM_PARSE_RECOVERED` entry per
  recovery, located over the skipped source, then the parse failure if any); its
  `error` MUST be the parse failure, or the first recovery of a parse that only
  recovered.
- `parse` of a source that parsed only by recovering MUST emit the recovered AST
  to STDOUT, the diagnostic payload to STDERR, and exit non-zero.
- `compile` of such a source MUST fail the unit without writing an artifact. A
  unit that failed to parse MUST carry `diagnostics`, and the top-level
  `failures` list MUST include each of them.

Postconditions:

- Commands that compile or execute a parsed source never proceed from a parse
  that only recovered.

## Test plan

`src/cli/stream.test.ts` ("cli.stream reports parse diagnostics"),
`src/cli/compile.test.ts` (per-unit `diagnostics`), `src/cli/main.test.ts` ("a
parse failure writes its diagnostics"), `src/cli/highlight.test.ts`.

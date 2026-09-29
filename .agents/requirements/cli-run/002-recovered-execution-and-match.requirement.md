---
id: cli-run-002
title: Run, exec, and match print a recovered result, report every diagnostic, and exit non-zero
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Recovered Execution and Matching

## Requirement

Preconditions:

- `uffda run`, `exec`, or `match` executes a module or matches a pattern.

Expected behavior:

- Execution and matching MUST request error recovery.
- A result that succeeded only by recovering MUST be written to STDOUT exactly
  as a clean result would be, its diagnostics MUST be written to STDERR, and the
  process MUST exit with the usage-failure status.
- Structured diagnostics MUST be `{ ok: false, error, diagnostics }`, where each
  recovery (`CLI_EXEC_RECOVERED` / `CLI_MATCH_RECOVERED`) carries the source
  offsets of the input it skipped, and `error` is the failure or the first
  recovery.
- Human-readable `match` diagnostics MUST list every diagnostic.
- A clean result MUST be unaffected (exit zero, nothing on STDERR).

## Test plan

`src/cli/main.test.ts` ("cli.main runCli reports recoveries"),
`src/cli/match.test.ts` ("cli.match reports recoveries"), `src/cli/exec.test.ts`
("cli.exec reports recoveries").

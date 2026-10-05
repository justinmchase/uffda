---
id: cli-run-003
title: CLI run matches the entry rule against --input, --input-json, or --input-file
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-execution-contracts"
---

# Run Input

## Requirement

Preconditions:

- The `run` command executes a module (see
  [module execution](./001-module-source-and-ast-execution.requirement.md)).

Expected behavior:

- `--input <text>` and `--input-file <path>` (read relative to the working
  directory) MUST give the entry rule a text subject, matched character by
  character, exactly as `match` does. The file's content is text, never JSON.
- `--input-json <json>` MUST give one JSON value as the subject; invalid JSON
  MUST fail with the same diagnostics as `match --input-json`.
- Giving more than one of them MUST be a usage error
  (`run accepts only one of --input, --input-json, or --input-file`).
- Without any of them the rule MUST match no input, as before.
- `exec`, `parse`, `compile` and `fmt` MUST reject all three
  (`--input, --input-json, and --input-file are only valid for match and run`).

Postconditions:

- A grammar module can be run over text from the command line:
  `uffda run hello.uff --input "hello world"`.
- Tests: `src/cli/contract.test.ts`, `src/cli/main.test.ts`,
  `src/cli/exec.test.ts`.

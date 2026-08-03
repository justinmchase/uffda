---
id: cli-workbench-001
title: CLI workbench manages deterministic editable sessions
spec_ref: ".agents/specifications/languages/cli/interactive-workbench.spec.md#session-model"
---

# Workbench Session Protocol

## Requirement

Preconditions:

- The `workbench` command receives newline-delimited JSON command objects from
  standard input.
- A session begins with a `start` command and may select a language and initial
  in-memory source.

Expected behavior:

- The workbench MUST emit one JSON response per command.
- A session MUST expose its selected language, active source, source path, and
  most recent parse result or diagnostic in every response.
- `set-source`, `set-language`, `open`, and `compile` MUST produce updated
  compilation feedback while preserving session state.
- `open`, `save`, and `export-ast` MUST resolve relative paths against the CLI
  working directory.
- File I/O and protocol failures MUST preserve the active in-memory source and
  return deterministic error codes.
- `end` MUST deactivate the session; subsequent non-`start` commands MUST fail
  deterministically.

Postconditions:

- Operators and automation can drive an editable, stateful workbench without
  changing parser or runtime semantics.

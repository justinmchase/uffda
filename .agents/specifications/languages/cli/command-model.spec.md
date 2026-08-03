# Command model and process contract

This chapter defines command topology, process-level options, exit behavior, and
deterministic mode resolution for the Uffda CLI.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Command topology contract

- The CLI MUST expose a stable command topology for:
  - compile workflows;
  - standard-input parsing workflows selected by `parse`;
  - expression execution workflows selected by `exec`;
  - pattern matching workflows selected by `match`;
  - Uffda module execution workflows selected by `run`;
  - interactive/workbench workflows.
- The command topology MUST support global flags that apply consistently across
  command families.
- Global options MUST include language selection and runtime resolution context.

## Exit-code policy contract

- The CLI MUST define deterministic exit codes for success and failure.
- Usage and flag-validation failures MUST map to a stable non-zero exit code.
- Configuration-resolution failures (for example invalid working-directory
  context) MUST map to a stable non-zero exit code distinct from successful
  execution.
- Internal/runtime exceptions SHOULD map to a stable internal-failure exit code.

## Error-shape contract

- User-facing failures MUST expose deterministic machine-consumable shape,
  including an error code and message.
- Error shape SHOULD identify which processing phase produced the failure
  (parsing, validation, configuration, execution).

## Mode selection precedence contract

- Mode resolution MUST be deterministic when command names and mode flags are
  both present.
- The `parse` command MUST select standard-input parsing explicitly; attached
  standard input alone MUST NOT change compile mode.
- If command selection conflicts with explicit mode flags, the CLI MUST fail
  with deterministic diagnostics.
- When no explicit command or mode flag is present, the CLI SHOULD resolve mode
  via deterministic fallback policy.

## Input selection contract

- `parse`, `exec`, `match`, and `run` MUST accept one source path or `-` for
  standard input.
- `parse`, `exec`, `match`, and `run` MAY accept inline source via `-e` or
  `--eval`.
- `exec`, `match`, and `run` MUST accept raw AST JSON only when `--ast` is
  supplied; they MUST NOT infer AST input from source text or file content.
- `parse` MUST reject `--ast` because it consumes source and produces AST.
- `exec`, `match`, and `run` MUST select expression, pattern, and Uffda module
  language respectively and MUST reject `--lang` overrides.
- `match` MUST treat `--input` and `--input-file` content as text by default.
  `--input-json` MUST parse its value as one JSON value and MUST reject invalid
  JSON with deterministic diagnostics.
- `--json` MUST select machine-readable command output and diagnostics. Without
  `--json`, match failures MUST be human-readable and include the rightmost
  failed pattern, input position, and source excerpt when source is available.

## Resolver and working-directory contract

- The effective working directory MUST be deterministic for a fixed invocation.
- Resolver root resolution MUST be deterministic relative to the effective
  working directory unless an absolute root is provided.
- Invalid path context MUST fail deterministically before compilation.

## Composition intent

- Process contract semantics SHOULD remain stable across future command
  additions so scripts and automation can depend on predictable CLI behavior.

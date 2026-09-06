# Compile, parse, and operation modes

This chapter defines file/glob compilation and STDIN/STDOUT stream behavior for
the Uffda CLI.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## File and glob compile contracts

- File compile mode MUST accept one or more explicit file paths.
- Compile mode MUST accept glob patterns and expand them in-process (not via
  shell globbing) to a deterministic set of matching files.
- Directory paths without glob metacharacters MUST be rejected; callers MUST
  pass an explicit file or a glob such as `src/**/*.uff`.
- Expansion ordering MUST be deterministic for a fixed file tree and pattern
  set.
- Compile output MUST include sufficient metadata to map emitted artifacts back
  to source file paths.

## AST artifact contracts

- Compile outputs MUST represent the Uffda syntax AST in JSON-serializable
  structures.
- Artifact emission MUST support one artifact per source unit and MUST define
  naming/path conventions deterministically.
- Each emitted JSON file MUST contain the raw syntax AST, without CLI-specific
  compiler, module identity, version, or source-path metadata.
- Compile results and diagnostics MUST retain source-path provenance separately
  from the emitted AST.

## Parse contracts

- The `parse` command MUST select source input from one path, standard input, or
  inline source.
- Parse mode MUST emit exactly one primary payload to STDOUT for each command
  invocation.
- Non-payload process messages SHOULD be emitted to STDERR.
- Parse mode MUST define deterministic behavior for empty input, including
  explicit success or failure output.
- Valid parse input MUST emit its raw selected-language syntax AST as one JSON
  payload to STDOUT; parse failure MUST emit one diagnostic JSON payload to
  STDERR.
- Empty full-Uffda stream input MUST emit an empty module AST.

## AST execution contracts

- The `exec` command MUST evaluate expression source by default and expression
  AST JSON when `--ast` is supplied.
- The `run` command MUST execute Uffda module source by default and module AST
  JSON when `--ast` is supplied.
- A module MUST execute its selected exported rule, defaulting to its first
  export when no entry rule is selected.
- An expression AST MUST execute as an implicit `Main` rule.
- The `match` command MUST match pattern source by default and pattern AST JSON
  when `--ast` is supplied against explicit subject text or a subject file.
- `match --input-json` MUST parse its explicit JSON subject as one JSON value
  before matching; `--input` and `--input-file` subjects MUST remain text.
- Match failures MUST render human-readable diagnostics by default. `--json`
  MUST select structured JSON diagnostics.
- String execution results MUST be emitted as text to STDOUT; other defined
  results MUST be emitted as JSON.
- Invalid JSON, unsupported ASTs, parse failures, compilation failures, match
  failures, and execution failures MUST emit deterministic diagnostics to
  STDERR.

## Failure and exit behavior

- If one or more compilation units fail for a multi-path or glob compile, the
  CLI MUST produce deterministic per-unit failure diagnostics.
- Exit status MUST indicate whether any input unit failed.
- Partial success behavior MUST be explicit and reproducible.

## Composition intent

- Compile and stream behavior SHOULD remain composable with scripting, CI
  pipelines, and artifact-based runtime workflows.

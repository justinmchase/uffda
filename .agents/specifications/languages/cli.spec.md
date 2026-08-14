# Command-line interface and interactive workbench

This chapter defines the contract for the Uffda CLI, including batch
compilation, parsing, language-specific operation execution, language-mode
selection, and an interactive workbench mode.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The CLI is the primary operator-facing surface for compiling Uffda-authored
source and inspecting outcomes without embedding Uffda programmatically.

## Core CLI requirements

- The CLI MUST provide deterministic behavior for fixed source input, flags, and
  resolver configuration.
- The CLI MUST support non-interactive execution suitable for CI and scripting.
- The CLI MUST provide machine-consumable output forms for compilation artifacts
  and diagnostics.
- The CLI MUST preserve source and module provenance in diagnostics so failures
  can map back to authored input.
- The CLI MUST be buildable as a distributable binary artifact via
  `deno compile`.
- Release binaries MUST be publishable through GitHub Releases with
  deterministic version labeling.

## Required mode families

- Compile mode: file and folder compilation into Uffda syntax AST artifacts,
  including JSON serialization suitable for runtime consumption.
- Parse mode: source input from standard input and syntax AST emission to
  standard output.
- Exec mode: expression evaluation from source or expression AST input.
- Match mode: pattern matching from source or pattern AST input against explicit
  subject input.
- Run mode: Uffda module execution from source or module AST input.
- Language-selection mode: `parse` selects full Uffda, pattern, or expression
  via `--lang` (full Uffda default); `exec`/`match`/`run` own their languages;
  `compile` always targets Uffda module AST artifacts.
- Interactive workbench mode: a stateful editor-like interface with dynamic
  visualization and file input/output orchestration.

## Canonical usage examples

The following examples define the intended operator-facing forms. `<path>`
denotes a source or AST file, and `-` denotes standard input.

Compile Uffda source files or a source directory to AST artifacts:

```sh
uffda compile ./src/main.uff
uffda compile ./src
```

Parse source to a raw AST JSON payload. `parse` selects the source language with
`--lang`, accepts a file path, standard input, or inline source, and is the only
command that uses `--lang`:

```sh
uffda parse --lang expression ./hello.expr
printf '(echo "hello")\n' | uffda parse --lang expression
uffda parse --lang pattern -e 'any'
uffda parse --lang uffda -e 'export Main; rule Main = ok -> 42;'
```

Evaluate an expression directly or from an explicit expression AST:

```sh
uffda exec -e '(echo "hello")'
uffda exec ./hello.expr
uffda parse --lang expression ./hello.expr | uffda exec --ast
```

Match a pattern directly or from an explicit pattern AST. Match subjects use
`--input` for literal text or `--input-file` for a file:

```sh
uffda match -e 'any' --input hello
uffda match ./word.pattern --input-file ./input.txt
uffda parse --lang pattern ./word.pattern | uffda match --ast --input hello
uffda match -e 'number' --input-json 42
uffda match --json -e 'number' --input-json 42
```

Run a Uffda module directly or from an explicit module AST. `--entry` selects a
specific exported rule; otherwise `run` selects the first export:

```sh
uffda run ./app.uff
uffda run ./app.uff --entry Main
uffda parse --lang uffda ./app.uff | uffda run --ast --entry Main
```

Operational commands never infer AST format from input content. `--ast` is
required whenever `exec`, `match`, or `run` receives raw AST JSON.

Match input is text by default. `--input-json` parses one JSON command-line
subject as a single value, allowing patterns to match JSON numbers, objects,
arrays, booleans, strings, and `null` directly. `--json` selects
machine-readable command output and diagnostics; without it, match failures MUST
be human-readable and include the relevant source excerpt and input path.

## Subtopics

- [command model and process contract](./cli/command-model.spec.md)
- [compile, parse, and operation modes](./cli/compile-and-stream.spec.md)
- [language-selection and output contracts](./cli/language-and-output.spec.md)
- [interactive workbench mode](./cli/interactive-workbench.spec.md)
- [distribution and release contracts](./cli/distribution-and-release.spec.md)

## Composition intent

- The CLI SHOULD compose existing language-layer and runtime contracts rather
  than introducing alternate parsing semantics.
- The interactive mode SHOULD reuse the same deterministic compiler and
  diagnostic pathways as non-interactive mode.

## Delivery milestones

### Milestone 1: CLI command model and process contract

- Define command topology, global options, exit-code policy, and deterministic
  error-shape contracts.
- Define mode selection precedence when multiple mode flags are present.
- Define how resolver configuration and working-directory context are resolved.

### Milestone 2: File and folder compilation to AST JSON

- Support single-file and recursive folder compilation inputs.
- Emit Uffda syntax AST artifacts that are serializable to JSON files.
- Define output path policies, overwrite behavior, and collision handling.

### Milestone 3: Raw syntax AST artifacts

- Emit raw Uffda syntax AST JSON without CLI-specific transport metadata.
- Preserve source provenance in compile results and diagnostics rather than in
  syntax AST payloads.

### Milestone 4: Parse and exec standard-input workflows

- Support source ingestion through the `parse` command and raw AST execution
  through the `exec` command.
- Support direct emission to STDOUT for ASTs, execution results, or diagnostics
  based on command behavior.
- Define payload framing and output-shape contracts to avoid ambiguous mixed
  output.

### Milestone 4.1: Language-owned operational commands

- Define `exec` for expressions, `match` for patterns, and `run` for Uffda
  modules.
- Support source paths, standard input, and inline source consistently across
  parse and operational commands.
- Require explicit `--ast` selection for raw AST JSON input so source and JSON
  payloads are never inferred by content.

### Milestone 5: Language-selection flags and default behavior

- Support language selection on `parse` via `--lang` for `uffda`, `pattern`, and
  `expression`.
- Default to full Uffda when `parse` is invoked without `--lang`.
- `exec`, `match`, and `run` MUST select expression, pattern, and Uffda module
  language respectively and MUST reject `--lang`.
- `compile` MUST emit Uffda module AST artifacts and MUST reject `--lang`.
- Define deterministic diagnostics for unsupported flag combinations.

### Milestone 6: Diagnostics, logging, and machine formats

- Support human-readable and machine-readable diagnostics (for example JSON).
- Ensure diagnostics include source span, module provenance, and phase
  boundaries.
- Define verbosity levels that do not change semantic outcomes.

### Milestone 7: Interactive workbench foundation

- Introduce a stateful interactive process with document/session lifecycle.
- Support in-memory editing, incremental recompile triggers, and persistent file
  open/save flows.
- Define deterministic command protocol for workbench actions.

### Milestone 8: Dynamic visualizer and inspection workflows

- Provide dynamic visualization for parse, compile, and failure states.
- Surface match-failure visualizations and pipeline phase boundaries in the
  interactive interface.
- Support focused inspection of AST nodes, spans, and module/rule provenance.

### Milestone 9: Interactive file I/O orchestration and automation hooks

- Provide explicit file import/export actions for source and artifacts.
- Support watch-style workflows for selected files/folders with deterministic
  debounce/refresh semantics.
- Define non-interactive hooks for automation to drive interactive capabilities
  where feasible.

### Milestone 10: Hardening, compatibility, and release gates

- Define backward-compatibility policy for commands, flags, and JSON output.
- Establish end-to-end validation matrix for file, folder, stream, and
  interactive modes across language selections.
- Define release criteria for CLI stability, documentation completeness, and
  operator-facing migration notes.

### Milestone 11: Deno compile distribution and GitHub Releases deployment

- Define deterministic `deno compile` build profiles for supported target
  platforms.
- Define artifact naming conventions that include version and target metadata.
- Publish compiled binaries and checksums to GitHub Releases for each tagged CLI
  release.
- Define release-manifest metadata and provenance expectations for downstream
  operators.
- Define rollback and reissue policy for faulty compiled release artifacts.

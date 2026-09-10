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

- Compile mode: file and glob compilation into Uffda syntax AST artifacts,
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

## Status

Required CLI mode families above are shipped: compile, parse, exec, match, run,
workbench, binary distribution, `uffda-setup`, and self-hosted language modules
under `./bin`.

Deferred polish (not release blockers):

- Watch-style file I/O orchestration and debounce/refresh automation.
- Explicit import/export actions for source and artifacts beyond current
  workbench protocol commands.
- Richer match-tree visualizer output (for example Mermaid) for debugging.

Normative distribution and release contracts live in
[distribution and release](./cli/distribution-and-release.spec.md). Bootstrap
contracts live in [compiler-bootstrap](./compiler-bootstrap.spec.md).

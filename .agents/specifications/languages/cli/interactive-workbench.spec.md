# Interactive workbench mode

This chapter defines the interactive CLI mode as an editor-oriented workbench
for authoring, compiling, visualizing, and persisting language artifacts.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Workbench purpose

- Interactive mode MUST provide more capability than a line-oriented REPL.
- Interactive mode MUST support iterative authoring with dynamic compile and
  diagnostics feedback.
- Interactive mode MUST support managed file input/output workflows.

## Session model

- Interactive mode MUST define explicit session start, save/export, and end
  semantics.
- Session state MUST identify selected language mode, active document(s), and
  current compile/diagnostic results.
- Session operations MUST be deterministic for a fixed command sequence.

## Initial command protocol

- The initial workbench transport MUST accept newline-delimited JSON command
  objects and emit one JSON response for each command.
- The protocol MUST support explicit session start and end operations.
- The protocol MUST expose selected language, active source, source provenance,
  and current compile result or diagnostic in its responses.
- A future TUI MAY provide richer interaction while preserving this protocol's
  deterministic session semantics.

## Editing and incremental compilation

- Workbench mode MUST support in-memory source editing operations.
- Workbench mode MUST support explicit or automatic incremental compile
  triggers.
- Incremental feedback SHOULD preserve phase boundaries (tokenization,
  expression, pattern, language-definition, compilation target) where relevant.

## Dynamic visualization

- Workbench mode MUST provide dynamic visualizations for successful and failed
  compilation paths.
- Match-failure visualization SHOULD integrate the runtime diagnostic renderer
  contract.
- Visualization output MUST remain inspectable in text-first environments even
  when richer UI affordances are present.

## File input/output handling

- Workbench mode MUST support opening existing files and saving edited source.
- Workbench mode MUST support exporting AST/runtime artifacts via explicit
  commands.
- File I/O failures MUST preserve in-memory state and report deterministic
  diagnostics.

## Automation and extensibility

- Workbench mode SHOULD provide a command protocol that can be automated.
- Workbench mode MAY support plugin-like visual extensions that do not alter
  compiler semantics.

## TUI dependency guidance

- The initial interactive implementation MAY use `jsr:@tui/tui` as the terminal
  UI foundation.
- Because the current package stream is dev-versioned, implementations MUST pin
  an explicit version and MUST NOT rely on floating version resolution.
- Interactive behavior contracts in this spec MUST remain independent from any
  single TUI package so the runtime can migrate dependencies without semantic
  drift.

## Composition intent

- Interactive workbench behavior SHOULD align with non-interactive CLI mode so
  users can move between automation and exploration without semantic drift.

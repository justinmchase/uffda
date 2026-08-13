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

## Terminal interface and protocol

- When standard input is a terminal, `workbench` MUST open a fullscreen terminal
  application instead of requiring line-oriented JSON commands.
- The terminal application MUST open on a landing screen presenting the ascii
  art banner and a prompt to select a workspace folder.
- Once a workspace folder is selected, the terminal application MUST provide
  three modes: file selection, file editor, and preview.
- File selection MUST render the workspace folder contents as an expandable
  tree; selecting a folder MUST toggle its expansion and selecting a file MUST
  switch to the file editor with that file open.
- The file editor and preview modes MUST NOT be reachable until a file has been
  selected.
- `Shift+Tab` MUST toggle between the file editor and preview modes once a file
  is open; `Esc` MUST step back toward file selection and, from file selection,
  back to the workspace landing screen.
- Editing input MUST trigger recompilation; the preview mode MUST reflect the
  current compilation or diagnostic outcome as read-only output.
- The terminal interface MUST support `Ctrl+S` to save an opened file; `Ctrl+C`
  MUST exit and restore the terminal.
- When standard input is not a terminal (piped), `workbench` MUST accept
  newline-delimited JSON command objects and emit one JSON response for each
  command, for automation.
- Both interfaces MUST preserve the same deterministic session semantics.

## Editing and incremental compilation

- Workbench mode MUST support in-memory source editing operations.
- Workbench mode MUST support explicit or automatic incremental compile
  triggers.
- Incremental feedback SHOULD preserve phase boundaries (tokenization,
  expression, pattern, language-definition, compilation target) where relevant.

## Dynamic visualization

- Workbench mode MUST provide dynamic visualizations for successful and failed
  compilation paths.
- The command protocol MUST provide a visualization operation that renders the
  current compilation state in text-first form, including selected language,
  source provenance, and AST or diagnostic outcome.
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

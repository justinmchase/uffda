---
id: cli-workbench-003
title: CLI workbench provides a landing screen, file browser, and editor/preview modes
spec_ref: ".agents/specifications/languages/cli/interactive-workbench.spec.md#terminal-interface-and-protocol"
---

# Fullscreen Terminal Application

## Requirement

Preconditions:

- The `workbench` command is invoked with terminal standard input.

Expected behavior:

- The command MUST open on a landing screen showing the ascii art banner and an
  editable workspace folder path; `Enter` MUST validate and open the folder, or
  show an error and remain on the landing screen.
- Once a workspace is open, the command MUST default to file selection mode and
  render the folder contents as an expandable tree.
- `Enter` on a directory row MUST toggle its expansion, lazily reading its
  contents; `Enter` on a file row MUST open that file and switch to editor mode.
- `Right Arrow` on a collapsed directory row MUST expand it; `Left Arrow` on an
  expanded directory row MUST collapse it.
- The file editor and preview modes MUST NOT be reachable until a file has been
  opened.
- Character input, `Enter`, `Tab`, `Backspace`, `Delete`, and arrow/home/end
  navigation MUST update the in-memory file content and cursor position in
  editor mode; each edit MUST refresh the compiled/diagnostic state used by
  preview mode.
- `Shift+Tab` MUST toggle between editor and preview modes when a file is open.
- `Esc` MUST return from editor or preview to file selection, and MUST return
  from file selection to the landing screen.
- `Ctrl+S` MUST save the open file; `Ctrl+C` MUST exit and restore the terminal.
- A file path supplied directly to `workbench` MUST bypass the landing screen,
  opening its containing folder and the file itself in editor mode.
- When standard input is piped rather than a terminal, `workbench` MUST use the
  newline-delimited JSON protocol instead of the terminal application.

Postconditions:

- Operators can select a workspace, browse its files, and author or inspect
  Uffda source directly in the terminal without a separate editor or manual JSON
  protocol.

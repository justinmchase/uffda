---
id: cli-language-server-011
title: Multi-root workspaces use the folder that contains the document
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#composition-intent"
---

# Multi-root workspace folders

## Requirement

Preconditions:

- The client initializes `uffda lsp` with more than one entry in
  `workspaceFolders`.
- Each folder is a Uffda project root (or has a nearest project file under it).

Expected behavior:

- For an open document whose path lies under one of the advertised folders, the
  server MUST load that document against the project and artifact layout of the
  containing folder (longest matching path prefix), not against
  `workspaceFolders[0]` alone.
- Import compile-on-demand and resolve MUST therefore write and read artifacts
  under that folder's `outDir`, even when another folder appears first in the
  initialize list.
- A document path that matches none of the folders MAY use the first folder as a
  fallback.

Postconditions:

- Tests: `src/cli/lsp.test.ts` (multi-root workspace folders step).

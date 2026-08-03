---
id: cli-compile-001
title: CLI compile mode emits AST artifacts for files and folders
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#file-and-folder-compile-contracts; .agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# File and Folder AST Artifact Emission

## Requirement

Preconditions:

- Compile mode receives one or more source file/folder paths and an output
  directory.

Expected behavior:

- File inputs MUST emit one AST artifact per file.
- Folder inputs MUST recursively discover source files.
- Artifacts MUST be JSON-serializable and include source-path provenance.

Postconditions:

- Compiled source units are represented as deterministic per-file AST artifact
  outputs.

---
id: cli-compile-001
title: CLI compile mode emits ModuleDeclaration artifacts for files and globs
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#file-and-glob-compile-contracts; .agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# File and Glob ModuleDeclaration Artifact Emission

## Requirement

Preconditions:

- Compile mode receives one or more source file paths and/or glob patterns, plus
  an output directory.

Expected behavior:

- File inputs MUST emit one ModuleDeclaration artifact per file.
- Glob inputs MUST expand via the CLI (using `@std/fs` glob expansion), not via
  shell globbing, and MUST include only matching files.
- Directory paths without glob metacharacters MUST be rejected.
- Expansion and emission ordering MUST be deterministic for a fixed tree and
  pattern set.
- Artifacts MUST be JSON-serializable ModuleDeclarations (`imports` / `exports`
  / `rules`), produced by the compile pipeline lower stage (previous published
  `UffdaRuntimeCompiler`).
- Source-path provenance MUST remain available through the compile result (see
  `cli-compile-004`).

Postconditions:

- Compiled source units are represented as deterministic per-file
  ModuleDeclaration artifact outputs.

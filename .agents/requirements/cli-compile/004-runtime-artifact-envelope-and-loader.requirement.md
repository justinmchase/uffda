---
id: cli-compile-004
title: CLI compile emits ModuleDeclaration codec artifacts
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts; .agents/specifications/languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break"
---

# ModuleDeclaration Artifact Emission

## Requirement

Preconditions:

- Compile mode has parsed a Uffda source unit into a syntax AST and run the
  previous published `UffdaRuntimeCompiler` lower stage.

Expected behavior:

- The emitted `.uff.ast` codec record MUST be the ModuleDeclaration
  (`imports` / `exports` / `rules`).
- The emitted record MUST NOT contain CLI-specific compiler, module identity,
  version, or source-path metadata.
- Compile result envelopes remain JSON and expose the codec record as
  `moduleCodec`.
- Source-path provenance MUST remain available through the compile result and
  failure diagnostics.

Postconditions:

- Operators can persist or inspect the runtime module without a CLI-defined
  transport wrapper, and resolvers can load the artifact without re-lowering.

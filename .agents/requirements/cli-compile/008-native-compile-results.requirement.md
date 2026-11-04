---
id: cli-compile-008
title: Compile emits one codec artifact and returns declaration codec text
spec_ref: ".agents/specifications/languages/cli/compile-and-stream.spec.md#ast-artifact-contracts"
---

# Native Compile Results

## Requirement

Preconditions:

- A source unit compiles successfully to a ModuleDeclaration.

Expected behavior:

- Compile MUST write one `.uff.ast` codec artifact and MUST NOT write a JSON
  declaration sibling.
- The compile result's `outputPath` MUST identify that `.uff.ast` artifact.
- Each successful unit MUST return its declaration payload in a `moduleCodec`
  string field; it MUST NOT return the declaration as a JSON object.
- Import-map expansion MUST update native declaration documents without
  converting the compiler result through JSON.

Postconditions:

- Resolver consumers can load the emitted artifact and compile results can
  preserve values unsupported by JSON.
- Tests: `src/compile.rs`, `src/cli/command_ports.rs`, `tests/cli.rs`.

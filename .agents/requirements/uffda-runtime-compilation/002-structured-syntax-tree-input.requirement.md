---
id: uffda-runtime-compilation-002
title: Compiler input is a structured Uffda syntax tree
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#compilation-boundary"
---

# Structured Syntax Tree Input

## Requirement

Preconditions:

- `UffdaLang` has produced a `UffdaSyntaxModule` with structured declaration,
  pattern, and projection values.

Expected behavior:

- The compiler entry rule MUST consume the `UffdaSyntaxModule` as structured
  scalar input.
- Compiler rules MUST match the module and declaration fields through runtime
  patterns.
- The compiler MUST NOT normalize the input as source text, tokenize it, or
  reparse pattern and projection source tokens.

Postconditions:

- The structured values produced by lower language layers remain the semantic
  input to runtime compilation.

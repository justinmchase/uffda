---
id: uffda-runtime-compilation-001
title: Uffda runtime compilation is an executable language
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#compiler-language-contract"
---

# Executable Compiler Language

## Requirement

Preconditions:

- The Uffda runtime compiler is available to the module resolver.

Expected behavior:

- The compiler MUST be declared as a runtime `ModuleDeclaration`.
- The compiler MUST export an entry rule that can be resolved and executed by
  the standard runtime module path.
- Executing the entry rule with valid compiler input MUST return a successful
  match whose value is a runtime `ModuleDeclaration`.

Postconditions:

- Compiler execution requires no bootstrap-only resolver or matching behavior.

---
id: uffda-runtime-compilation-006
title: A source-authored Morse language targets the Uffda runtime
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#reusable-target-contract"
---

# Canonical Morse Language

## Requirement

Preconditions:

- `MorseLang` is authored as a valid Uffda module using canonical `=` rule
  bindings and inline exported-rule syntax.
- Every encoded symbol in the input ends with `/`.
- Morse input is provided as an iterable character stream.

Expected behavior:

- `MorseLang` MUST parse through `UffdaLang`.
- Its syntax tree MUST compile through `UffdaRuntimeCompiler`.
- The compiled module MUST decode all letters `A` through `Z`, figures `0`
  through `9`, and punctuation `.,?'!/()&:;=+-_"$@`.
- The compiled module MUST translate `.../---/.../` to `SOS` through standard
  runtime module execution.

Postconditions:

- The fixture demonstrates a source-authored DSL compiling to the reusable Uffda
  runtime target without bootstrap-only parsing or execution behavior.

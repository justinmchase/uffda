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
- Morse or uppercase supported text input is provided as an iterable character
  stream.

Expected behavior:

- `MorseLang` MUST parse through `UffdaLang`.
- Its syntax tree MUST compile through `UffdaRuntimeCompiler`.
- The compiled module MUST encode and decode all letters `A` through `Z`,
  figures `0` through `9`, and punctuation `.,?'!/()&:;=+-_"$@`.
- The compiled module MUST preserve space separators and control characters
  through an encode/decode round trip.
- The compiled module MUST translate `.../---/.../` to `SOS` through standard
  runtime module execution.
- The compiled module MUST round trip a multi-paragraph public-domain prose
  excerpt from text to Morse and back to the original text.

Postconditions:

- The fixture demonstrates a source-authored DSL compiling to the reusable Uffda
  runtime target without bootstrap-only parsing or execution behavior.

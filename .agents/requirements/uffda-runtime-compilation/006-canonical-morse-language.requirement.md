---
id: uffda-runtime-compilation-006
title: A source-authored Morse language targets the Uffda runtime
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#reusable-target-contract; .agents/specifications/languages/uffda-syntax/morse-language.spec.md#compilation-contract"
---

# Canonical Morse Language

## Requirement

Preconditions:

- `MorseLang` is authored as a valid Uffda module using canonical `=` rule
  bindings and inline exported-rule syntax in `examples/morse/morse.uff`.
- A checked-in ModuleDeclaration fixture `examples/morse/morse.uff.ast.json`
  matches that source (regenerated with `uffda compile examples/morse/morse.uff`
  and copied from `bin/ast/examples/morse/morse.uff.ast.json` whenever the
  `.uff` changes).
- Every encoded symbol in the input ends with `/`.
- Morse or uppercase supported text input is provided as an iterable character
  stream.

Expected behavior:

- A small source-authored Morse fragment MUST parse through `UffdaLang`, compile
  through `UffdaRuntimeCompiler`, and execute through the standard runtime
  module path in the default unit suite (proving the pipeline without parsing
  the full ~6KB fixture).
- The full compiled module (loaded from `morse.uff.ast.json`) MUST encode and
  decode all letters `A` through `Z`, figures `0` through `9`, and punctuation
  `.,?'!/()&:;=+-_"$@`.
- That module MUST preserve space separators and control characters through an
  encode/decode round trip.
- That module MUST translate `.../---/.../` to `SOS` through standard runtime
  module execution.
- That module MUST round trip a multi-paragraph public-domain prose excerpt from
  text to Morse and back to the original text.
- Default-suite remport tests MUST NOT parse `examples/morse/morse.uff` through
  `UffdaLang` (that parse is tens of seconds in debug and is measured by
  `test/perf/morse-compile.report.ts`).

Postconditions:

- The fixture demonstrates a source-authored DSL compiling to the reusable Uffda
  runtime target without bootstrap-only parsing or execution behavior.
- Tests: `rust/src/lang_tests/uffda.rs`
  (`remport_tiny_source_authored_morse_parses_compiles_and_runs`,
  `remport_morse_artifact_roundtrips_repertoire_and_prose`).

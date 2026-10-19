# Canonical Morse language

This chapter defines the source-authored Morse fixture used to validate Uffda as
a reusable compilation target.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Symbol repertoire

- `MorseLang` MUST encode and decode the International Morse letters `A` through
  `Z`.
- `MorseLang` MUST encode and decode the figures `0` through `9`.
- `MorseLang` MUST encode and decode these punctuation symbols: `.` `,` `?` `'`
  `!` `/` `(` `)` `&` `:` `;` `=` `+` `-` `_` `"` `$` `@`.
- Symbol encodings MUST follow the International Morse code table standardized
  by Recommendation ITU-R M.1677.

## Input contract

- The `Morse` entry MUST accept an iterable stream of Morse symbols and decode
  it to text.
- The `Text` entry MUST accept uppercase supported text and encode it to Morse.
- Every encoded symbol MUST end with `/` so prefix-related codes remain
  unambiguous.
- The final encoded symbol MUST also end with `/`.
- Space separators and control characters MUST pass through encoding and
  decoding unchanged so text layout can round trip exactly.

## Compilation contract

- `MorseLang` MUST be authored as Uffda source using canonical `=` rule
  declarations and inline exported-rule syntax (`examples/morse/morse.uff`).
- It MUST parse through `UffdaLang`, compile through `UffdaRuntimeCompiler`, and
  execute through the standard runtime module path. Default unit tests MAY load
  the checked-in ModuleDeclaration sibling `examples/morse/morse.uff.ast.json`
  for repertoire and round-trip coverage so they do not re-parse the full source
  on every run; regenerating that sibling after `.uff` edits re-exercises the
  full parse/compile path. Full-source parse timing is tracked by
  `test/perf/morse-compile.report.ts`.
- Its authored source MUST express encoding and decoding through Uffda rules and
  expressions, without host-language symbol-table or translation helpers.

# Canonical Morse language

This chapter defines the source-authored Morse fixture used to validate Uffda as
a reusable compilation target.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Symbol repertoire

- `MorseLang` MUST decode the International Morse letters `A` through `Z`.
- `MorseLang` MUST decode the figures `0` through `9`.
- `MorseLang` MUST decode these punctuation symbols: `.` `,` `?` `'` `!` `/` `(`
  `)` `&` `:` `;` `=` `+` `-` `_` `"` `$` `@`.
- Symbol encodings MUST follow the International Morse code table standardized
  by Recommendation ITU-R M.1677.

## Input contract

- Morse input MUST be supplied as an iterable stream of `.` `-` and `/`
  characters.
- Every encoded symbol MUST end with `/` so prefix-related codes remain
  unambiguous.
- The final encoded symbol MUST also end with `/`.

## Compilation contract

- `MorseLang` MUST be authored as Uffda source using canonical `=` rule
  declarations and inline exported-rule syntax.
- It MUST parse through `UffdaLang`, compile through `UffdaRuntimeCompiler`, and
  execute through the standard runtime module path.
- Its authored source MUST express decoding through Uffda rules and expressions,
  without host-language symbol-table or translation helpers.

# Literal and terminal syntax

This chapter defines terminal expression forms used by the expression language.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Terminal syntax MUST include numeric, boolean, and nullish literal forms,
  identifier/reference forms, and the symbol literal `@Identifier`.
- `@Identifier` is the token `@` followed by an identifier. It denotes the
  global registry symbol whose key is that identifier: the same value as the
  data-codec forms `@symbol"Identifier"` and `s"Identifier"`.
- `@Identifier` is not an identifier escape. `@func` is a symbol named `func`.
  It MUST NOT make a reserved word usable as an identifier. Identifiers still
  MUST NOT be reserved words, and there is no keyword-escape spelling.
- Literal and reference syntax forms MUST be lexically distinguishable for
  deterministic parsing. `@Identifier` is a symbol literal; a bare identifier
  remains a reference.

## Valid syntax examples

- `123`
- `0`
- `42`
- `true`
- `false`
- `null`
- `undefined`
- `name`
- `userName1`
- `@name`
- `@func`

## Invalid syntax examples

- `` (empty input)
- `12abc` (mixed numeric/reference token with no valid boundary rule)
- `@` (a symbol literal missing its identifier)
- `@1` (`1` is not an identifier)

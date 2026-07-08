# Literal and terminal syntax

This chapter defines terminal expression forms used by the expression language.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Terminal syntax MUST include numeric, boolean, and nullish literal forms, and
  identifier/reference forms.
- Literal and reference syntax forms MUST be lexically distinguishable for
  deterministic parsing.

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

## Invalid syntax examples

- `` (empty input)
- `12abc` (mixed numeric/reference token with no valid boundary rule)
- `@name` (unsupported reference prefix)

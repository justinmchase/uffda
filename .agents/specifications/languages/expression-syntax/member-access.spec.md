# Member access syntax

This chapter defines property projection syntax for expression values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Member access MUST use explicit dot syntax.
- Member access MUST project a named property from an evaluated base
  expression.
- Member syntax MUST remain unambiguous with spread syntax, which uses `...`
  instead of a single `.`.
- Member syntax SHOULD remain postfix and low-sugar for code generation.

## Canonicalization examples

- `user.name` -> `(member user name)`
- `settings.theme.primary` -> `(member (member settings theme) primary)`

## Valid syntax examples

- `user.name`
- `config.theme.primary`
- `data.items.length`

## Invalid syntax examples

- `.name`
- `user.`
- `user..name`

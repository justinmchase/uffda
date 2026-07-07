# String and interpolation syntax

This chapter defines quoted string syntax and interpolation forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- String literals MUST use `"` delimiters.
- Interpolation syntax MUST preserve explicit delimiter boundaries (`{` and `}`)
  for downstream expression parsing.
- A literal opening curly in string content MUST be escaped as `\{`.
- String interpolation MUST support expression payloads including object-like
  interpolation structures used for meta-programming.
- Interpolation syntax MUST remain low-sugar and explicit; implicit template
  rewrites are NOT allowed.

## Valid syntax examples

- `"hello"`
- `"hello {name}"`
- `"{user.name}"`
- `"\{{example}}"` (escaped literal `{` followed by `{example}` interpolation,
  followed by literal `}`)
- `"{ {name: user.name} }"` (object interpolation payload with explicit
  delimiters)

## Invalid syntax examples

- `"unterminated`
- `"hello {name"` (missing closing `}`)
- `"hello }"` (unmatched closing delimiter)
- `"{{example}}"` (first `{` starts interpolation; use `\{` for literal `{`)
- `` `${name}` `` (unsupported template-literal sugar form in this layer)

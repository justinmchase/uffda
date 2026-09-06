# Pattern string literals

This chapter defines quoted string literals in pattern bodies and their escape
sequences.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../../languages.spec.md#conventions).

## Quoted strings

- A pattern string literal MUST be a double-quoted sequence `"…"`.
- The literal value MUST be the concatenation of interior string parts after
  escape interpretation.
- A bare pattern string literal MUST map to an Equal pattern whose `value` is
  that string.

## Escape sequences

Inside a pattern string literal, a backslash introduces an escape. The following
escapes MUST be recognized and MUST project the corresponding character:

| Escape | Result       |
| ------ | ------------ |
| `\t`   | U+0009 (tab) |
| `\n`   | U+000A (LF)  |
| `\r`   | U+000D (CR)  |
| `\\`   | U+005C (`\`) |
| `\"`   | U+0022 (`"`) |

- An unrecognized escape of the form `\` followed by one character MUST remain
  two characters in the literal value (backslash plus that character), until a
  later revision defines additional escapes.
- Unescaped whitespace or newline characters inside quotes MAY be discarded by
  the default no-whitespace semantic token stream. Authors MUST use `\t`, `\n`,
  and `\r` when those characters are required in an Equal value.

## Tokenizer escape followers

- When tokenizing a quoted string, `\` MUST consume exactly one following
  character (not a greedy word or whitespace run).
- That follower MUST be emitted as a semantic token so PatternLang (and other
  no-whitespace consumers) can observe `\t`, `\n`, `\r`, `\\`, and `\"`.

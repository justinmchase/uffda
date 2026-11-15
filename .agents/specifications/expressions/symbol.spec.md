# Symbol expression

This chapter defines the `@Identifier` symbol literal.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

A symbol expression writes a global registry symbol in an expression. The key
is the identifier after `@`.

## Behavioral expectations

- `@Identifier` MUST evaluate to the global registry symbol whose key is
  `Identifier`.
- That value MUST be the same symbol as the data-codec forms
  `@symbol"Identifier"` and `s"Identifier"`, and the same symbol as
  `(symbol "Identifier")`.
- Evaluation MUST NOT depend on runtime scope. `@Name` is not a reference to a
  binding named `Name`.
- The identifier MAY be a reserved word. `@func` MUST evaluate to the symbol
  named `func`.
- `@Identifier` MUST NOT be an identifier escape. A reserved word MUST NOT
  become a legal identifier by writing `@` in front of it. Declaration names
  and other `IdentifierToken` positions MUST still reject reserved words, and
  MUST reject `@func` as a name.

## Error conditions

- `@` without an identifier MUST fail.
- The symbol expression itself does not introduce further evaluation errors for
  a well-formed identifier.

## Composition intent

- Symbol expressions SHOULD be used wherever a global registry symbol is a
  literal value. Keys that are not identifiers, including isolated surrogate
  units, remain data-codec string forms (`s"…"` and `@symbol"…"`).

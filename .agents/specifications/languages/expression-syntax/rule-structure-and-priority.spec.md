# Expression rule structure and priority

This chapter documents the internal expression-language parser rules used by the
default expression module set.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Overall rule priority order

Evaluation entry priority in the default expression grammar is:

1. `Expression`
2. `Unary`
3. `Primary`
4. `Sequence` | `Array` | `Object` | `Boolean` | `Nullish` | `Terminal` |
   `String`
5. terminal leaf rules (`Number`, `Reference`) and string helper rules

Within `Primary`, ordered-choice priority is:

1. `Sequence`
2. `Terminal`
3. `String`

Within `Terminal`, ordered-choice priority is:

1. `Token<Number>`
2. `Token<Reference>`

Within `String`, ordered-choice priority for inner segments is:

1. `StringExpression`
2. `StringContent`

## Rule: Expression

### Purpose

Top-level expression entry rule; delegates to `Unary`.

### Called by

- `ExpressionLang` pipeline final step (`... -> Expression`)

### Calls

- `Unary`

### Direct-left-recursive

- No.
- Reason: `Expression` resolves `Unary` directly and does not resolve
  `Expression` as its first child.

### Matching syntax examples

- `42`
- `name`
- `(add 1 2)`
- `"hello {name}"`

## Rule: Unary

### Purpose

Unary operator layer entry. In current implementation this delegates to
`Primary`, with unary forms layered here.

### Called by

- `Expression`

### Calls

- `Primary`

### Direct-left-recursive

- No.
- Reason: `Unary` resolves `Primary` and does not resolve `Unary` in first
  position.

### Matching syntax examples

- `not value`
- `(not value)`
- `name`

## Rule: Primary

### Purpose

Primary expression selector; chooses among sequence invocation, terminal value,
string forms, and concrete literal forms.

### Called by

- `Unary`
- `Sequence` (for nested invocation arguments)
- `StringExpression` (for interpolation payload in current implementation)

### Calls

- `Sequence`
- `Array`
- `Object`
- `Boolean`
- `Nullish`
- `Terminal`
- `String`

### Direct-left-recursive

- No.
- Reason: `Primary` is an ordered choice over other rules and does not resolve
  `Primary` directly in first position.

### Matching syntax examples

- `(add 1 2)`
- `[1 2 true null]`
- `{name: 1, enabled: true}`
- `x`
- `"hello"`

## Rule: Sequence

### Purpose

Parses parenthesized invocation structure and constructs invocation expression
nodes.

### Called by

- `Primary`

### Calls

- `Token<OpenParen>`
- `Token<Primary>` (quantified, one or more)
- `Token<CloseParen>`

### Direct-left-recursive

- No.
- Reason: the rule begins by matching `Token<OpenParen>`, which consumes an
  opening delimiter before any recursive descent through `Primary` can occur.

### Matching syntax examples

- `(f)`
- `(f x)`
- `(f x y)`
- `( add   1   2 )`

## Rule: Array

### Purpose

Parses bracket-delimited array literals (including spread-style elements in
syntax policy) and constructs array expression nodes.

### Called by

- `Primary`

### Calls

- `Token<OpenBracket>`
- `ArrayElements` (optional)
- `Token<CloseBracket>`

Spread-related syntax policy for this rule family:

- Array element initializers are represented canonically as `(elem value)`.
- Array spread initializers are represented canonically as `(spread xs)`.

### Direct-left-recursive

- No.
- Reason: `Array` begins by matching `Token<OpenBracket>`, which consumes an
  opening delimiter before descending to element rules.

### Matching syntax examples

- `[]`
- `[1]`
- `[1 2 true null]`
- `[a ...xs]`

Implementation note:

- Current parser implementation supports element lists and reserves spread-style
  composition in the rule family; spread token branches may be completed in a
  follow-up grammar update.

## Rule: Object

### Purpose

Parses brace-delimited object literals (including spread-style members in syntax
policy) and constructs object expression nodes.

### Called by

- `Primary`

### Calls

- `Token<OpenBrace>`
- `ObjectPairs` (optional)
- `Token<CloseBrace>`

Spread-related syntax policy for this rule family:

- Object key initializers are represented canonically as `(key name value)`.
- Object spread initializers are represented canonically as `(spread base)`.

### Direct-left-recursive

- No.
- Reason: `Object` begins by matching `Token<OpenBrace>`, which consumes an
  opening delimiter before descending to pair rules.

### Matching syntax examples

- `{}`
- `{name: 1}`
- `{name: 1, enabled: true, fallback: undefined}`
- `{...base, name: 1}`

Implementation note:

- Current parser implementation supports explicit key/value pairs and reserves
  spread-style member composition in the rule family; spread token branches may
  be completed in a follow-up grammar update.

## Rule: Boolean

### Purpose

Parses boolean literals and projects boolean expressions.

### Called by

- `Primary`

### Calls

- `Token<TrueKeyword>`
- `Token<FalseKeyword>`

### Direct-left-recursive

- No.
- Reason: `Boolean` resolves token-delimited keyword rules and does not resolve
  `Boolean` in first position.

### Matching syntax examples

- `true`
- `false`

## Rule: Nullish

### Purpose

Parses `null` and `undefined` literals and projects value expressions.

### Called by

- `Primary`

### Calls

- `Token<NullKeyword>`
- `Token<UndefinedKeyword>`

### Direct-left-recursive

- No.
- Reason: `Nullish` resolves token-delimited keyword rules and does not resolve
  `Nullish` in first position.

### Matching syntax examples

- `null`
- `undefined`

## Rule: Terminal

### Purpose

Selects token-wrapped terminal leaves (`Number` or `Reference`).

### Called by

- `Primary`

### Calls

- `Token<Number>`
- `Token<Reference>`

### Direct-left-recursive

- No.
- Reason: `Terminal` does not resolve `Terminal` in first position.

### Matching syntax examples

- `0`
- `42`
- `name`

## Rule: Number

### Purpose

Parses digit-only numeric terminal text and projects number expressions.

### Called by

- `Terminal`

### Calls

- `Digit` (via quantified `Into`)

### Direct-left-recursive

- No.
- Reason: `Number` does not reference `Number` in first position.

### Matching syntax examples

- `0`
- `123`
- `42`

## Rule: Reference

### Purpose

Parses identifier terminal text and projects reference expressions.

### Called by

- `Terminal`

### Calls

- `Identifier`

### Direct-left-recursive

- No.
- Reason: `Reference` does not reference `Reference` in first position.

### Matching syntax examples

- `name`
- `_value`
- `userName1`

## Rule: String

### Purpose

Parses quoted string literals with escaped content and interpolation segments.

### Called by

- `Primary`

### Calls

- `StringExpression`
- `StringContent`
- helper rules: `EscapedString`, `EscapedCurlyBegin`, `EscapedDoubleQuote`

### Direct-left-recursive

- No.
- Reason: `String` starts with `"` delimiter matching and does not recurse to
  `String` in first position.

### Matching syntax examples

- `"hello"`
- `"hello {name}"`
- `"\{{example}}"`
- `"{ {name: user.name} }"`

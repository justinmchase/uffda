# Array and object structuring syntax

This chapter defines array, object, set, and map value-construction expression
forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Expression language MUST support array, object, set, and map structuring
  expressions.
- Structuring syntax MAY support two equivalent surface forms:
  1. canonical low-sugar forms, and
  2. minimal JavaScript-style sugar forms (`[]` and `{}`).
- JavaScript-style sugar applies to arrays and objects only; set and map are
  canonical-only in this layer.
- All structuring surface forms MUST normalize deterministically to one
  canonical internal structuring representation.
- Structuring syntax MUST support spread-style composition in arrays and
  objects.
- Set and map structuring MUST be expressed in canonical low-sugar forms.
- Destructuring syntax MUST NOT be defined in expression structuring forms;
  destructuring belongs to pattern/binding layers.

## Canonicalization examples

- `[a b]` -> `(array (elem a) (elem b))`
- `{name: value}` -> `(object (key name value))`
- `(set a b)` -> `(set a b)`
- `(map (key a b))` -> `(map (key a b))`
- `[a ...xs]` -> `(array (elem a) (spread xs))`
- `{...base, name: value}` -> `(object (spread base) (key name value))`

## Valid syntax examples

- `(array (elem 1) (elem 2) (elem 3))`
- `(object (key name value) (key age 42))`
- `(set a b c)`
- `(map (key a b) (key c d))`
- `[1 2 3]`
- `{name: value, age: 42}`
- `{...base, name: value}`

## Invalid syntax examples

- `[a,b]` (comma-delimited array elements are not part of this MVP surface form)
- `{name}` (implicit key-value shorthand not supported in this layer)
- `{...}` (missing spread operand)
- `[{x}] = value` (destructuring assignment syntax is outside expression layer)

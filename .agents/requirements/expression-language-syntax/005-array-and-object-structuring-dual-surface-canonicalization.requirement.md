---
id: expression-language-syntax-005
title: Expression language supports array and object structuring with deterministic dual-surface canonicalization
spec_ref: ".agents/specifications/languages/expression-syntax/array-and-object-structuring.spec.md#syntax-requirements"
---

# Array and Object Structuring Dual-surface Canonicalization

## Requirement

Preconditions:

- Expression syntax includes array/object/set/map value-construction forms.

Expected behavior:

- The language MUST support canonical low-sugar structuring forms.
- The language MAY support minimal JavaScript-style structuring sugar (`[]` and
  `{}`) for authoring ergonomics.
- JavaScript-style sugar MUST apply to arrays/objects only.
- Supported surface forms MUST normalize deterministically to one canonical
  structuring representation.
- Set and map structuring MUST be expressed in canonical forms such as
  `(set
  ...)` and `(map (key ... ...))`.
- Destructuring forms MUST remain outside expression syntax and be handled by
  pattern/binding layers.

Valid syntax examples:

- `(array 1 2 3)`
- `(object (key name value))`
- `(set a b)`
- `(map (key a b))`
- `[1, 2, 3]`
- `{name: value}`

Invalid syntax examples:

- `{name}`
- `{...}`
- `[{x}] = value`

Postconditions:

- Structuring syntax remains human-friendly while preserving canonical,
  codegen-oriented internal representation.

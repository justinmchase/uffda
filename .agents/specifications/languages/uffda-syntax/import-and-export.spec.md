# Import and export declaration syntax

This chapter defines Uffda import and export declaration forms.

## Logical purpose

Import and export declarations express module dependencies and externally
visible symbols for Uffda modules.

## Import declaration contracts

- Import declarations MUST begin with the `import` declaration keyword.
- Import declarations MUST define a module source and one or more imported names
  or aliases.
- Import declarations SHOULD normalize to runtime `ImportDeclaration` forms
  without hidden context-sensitive transformations.
- Import declaration syntax SHOULD remain explicit about default and named
  import forms when both are supported.

## Export declaration contracts

- Export declarations MUST begin with the `export` declaration keyword.
- Export declarations MUST identify names exported from the current module.
- Uffda MUST support both export families:
  - standalone export declarations that begin with `export`
  - exported rule declarations that begin with `export rule`
- Standalone export declarations MUST support direct-name export lists without
  commas.
- Standalone export declarations MUST support single-target aliasing.
- Alias exports MUST bind exactly one alias to exactly one exported name per
  declaration.
- Export declarations SHOULD support explicit default export designation where
  applicable.
- Export declaration syntax MUST normalize to runtime `ExportDeclaration` forms.

## Boundary and diagnostics

- Invalid import/export forms MUST fail deterministically at syntax boundaries.
- Import/export diagnostics SHOULD include stable source spans for declaration
  headers and names.

## Canonical starter forms

- Import declarations MUST accept the canonical starter form:
  `import "./module.ts" Alias;`.
- Standalone export declarations MUST accept canonical starter forms:
  - `export A;`
  - `export A B C;`
  - `export B = A;`
- Exported rule declarations MUST accept canonical starter forms:
  - `export rule A any;`
  - `export rule A any -> 1;`

## Subtopics

- [import declaration syntax](./imports.spec.md)
- [export declaration syntax](./exports.spec.md)

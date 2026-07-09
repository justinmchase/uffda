# Uffda syntax contracts

This chapter defines syntax contracts for the top-level Uffda
language-definition surface that authors use to declare modules and rules.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](./languages.spec.md#conventions).

## Scope boundary

- This chapter covers module-level declaration syntax only.
- Pattern body syntax is delegated to `PatternLang`.
- Projection expression syntax is delegated to `ExpressionLang`.
- Runtime execution semantics remain governed by runtime and pattern/expression
  layers.

## Layer goals

- Uffda syntax MUST provide explicit forms for imports, exports, and rule
  declarations.
- Uffda syntax MUST require each top-level declaration family to start with a
  distinct declaration keyword.
- Uffda syntax MUST preserve declaration order.
- Uffda syntax SHOULD remain low-sugar and deterministic for bootstrap and
  self-hosting workflows.

## Core declaration families

- [module structure syntax](./uffda-syntax/module-structure.spec.md)
- [import and export declaration syntax](./uffda-syntax/import-and-export.spec.md)
- [import declaration syntax](./uffda-syntax/imports.spec.md)
- [export declaration syntax](./uffda-syntax/exports.spec.md)
- [rule declaration syntax](./uffda-syntax/rule-declarations.spec.md)
- [rule declaration keyword forms](./uffda-syntax/pattern-declarations.spec.md)
- [canonical executable examples](./uffda-syntax/canonical-examples.spec.md)

## Integration contracts

- Rule pattern bodies MUST be parsed by `PatternLang`.
- Rule projection expressions MUST be parsed by `ExpressionLang`.
- Uffda entrypoints that parse complete source documents MUST enforce full-input
  consumption.

## Module ordering and separators

- All import declarations MUST appear before all rule declarations.
- Top-level declarations MUST be separated by `;`.

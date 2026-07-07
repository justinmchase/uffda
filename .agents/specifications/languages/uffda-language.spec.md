# Uffda language-definition layer

This chapter defines contracts for the Uffda language-definition layer that
describes modules, rules, and language metadata on top of shared lower layers.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The Uffda language-definition layer composes tokenizer, expression, and pattern
layers into author-facing language/module declarations.

## Layer requirements

- Uffda language definitions MUST be representable through lower-layer outputs
  without requiring bootstrap-only parsing exceptions.
- Language-definition contracts MUST preserve stable module/rule identity across
  compilation and runtime resolution.
- Language-definition diagnostics MUST map back to authored source context.

## Integration requirements

- Uffda language definitions MUST interoperate with module-resolution and
  runtime execution contracts.
- Language-definition outputs SHOULD be consumable by compiler/meta layers for
  self-hosting progression.

## Composition intent

- Uffda language-definition contracts SHOULD remain explicit enough that
  alternative top-level language definitions can interoperate with shared lower
  layers.

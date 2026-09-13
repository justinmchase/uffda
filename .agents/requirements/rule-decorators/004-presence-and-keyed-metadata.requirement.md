---
id: rule-decorators-004
title: Attribute presence is always recorded and each decorator's result is stored on metadata keyed by the decorator's own name
spec_ref: ".agents/specifications/runtime/rule-metadata.spec.md#constraints; .agents/specifications/runtime/rule-metadata.spec.md#mechanism"
---

# Presence Recording and Keyed Metadata

## Requirement

Preconditions:

- A `rule` or `func` declaration carries one or more distinct, successfully
  invoked attributes.

Expected behavior:

- Applying an attribute MUST append its identity (the resolved `DecoratorFunc`
  and its call arguments) to the declaration's ordered `attributes` list,
  regardless of what the decorator's invocation returns, including a non-object
  or no meaningful return value.
- A decorator's invocation result, of any type (object, scalar, `null`, or
  `undefined`), MUST be assigned onto the declaration's `metadata` at the key
  equal to the decorator's own name (`metadata[Name] = result`).
- Metadata MUST NOT be shallow-merged across decorators; each decorator's result
  occupies exactly one key, so two decorators can never overwrite one another's
  keys regardless of what shape their results take.

Postconditions:

- Querying "was decorator `D` applied to declaration `X`?" MUST be possible by
  inspecting `X.attributes` independent of `X.metadata`'s contents.
- `X.metadata[D]` reflects exactly decorator `D`'s own return value, unaffected
  by any other decorator applied to `X`.

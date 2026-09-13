---
id: rule-decorators-005
title: Applying the identical resolved decorator twice to one declaration is rejected, while unresolvable, wrongly-namespaced, or exception-raising decorators fail deterministically
spec_ref: ".agents/specifications/runtime/rule-metadata.spec.md#constraints; .agents/specifications/runtime/rule-metadata.spec.md#failure-surface; .agents/specifications/languages/uffda-syntax/declaration-attributes.spec.md#failure-surface"
---

# Duplicate Decorator Rejection and Failure Modes

## Requirement

Preconditions:

- A `rule` or `func` declaration carries a written attribute list.

Expected behavior:

- If the same resolved `DecoratorFunc` appears more than once in one
  declaration's attribute list (for example `[Token][Token]`), declaration
  resolution MUST fail, checked by decorator identity rather than by the
  metadata key the decorator would produce.
- Two distinct decorators that happen to share a name-adjacent or otherwise
  similar shape MUST NOT be rejected as duplicates; only identical resolved
  decorator identity triggers rejection.
- An attribute name that does not resolve to any `decorator` declaration MUST
  fail declaration resolution the same way an unresolved reference fails
  elsewhere in the language.
- An attribute name that resolves to a `rule` or ordinary `func` name (not a
  `decorator` declaration) MUST fail declaration resolution the same way an
  unresolved reference fails; it MUST NOT fall back to invoking that rule/func.
- A decorator invocation that raises an expression exception MUST propagate that
  exception as a declaration-resolution failure rather than silently skipping
  the attribute or the declaration.

Postconditions:

- Attribute-list resolution failures are deterministic and attributable to a
  specific attribute entry (duplicate identity, unresolved/wrongly-namespaced
  name, or raised exception), never silently absorbed.

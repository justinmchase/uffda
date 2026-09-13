---
id: rule-decorators-007
title: Decorator and ordinary rule/func/import namespaces are fully disjoint, both at declaration time and at reference/attribute resolution time
spec_ref: ".agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md#core-contracts; .agents/specifications/runtime/rule-metadata.spec.md#namespace-constraints"
---

# Namespace Separation Between Decorators and Ordinary Declarations

## Requirement

Preconditions:

- A module declares a mix of `rule`, `func`, `decorator`, and imported names.

Expected behavior:

- A `decorator` declaration's name MUST NOT collide with any `rule`, `func`, or
  imported name in the same module, and declaring one that does MUST fail
  declaration resolution.
- A `decorator` name MUST NOT be resolvable as an ordinary reference or
  invocation target from within an `ExpressionLang` expression (for example
  `(Name)` inside a rule/func body evaluating a decorator name MUST fail the
  same way any unresolved reference fails).
- An attribute's `Name` MUST NOT resolve against `rule`, `func`, or ordinary
  imported names, even if such a name happens to exist and would otherwise be a
  plausible callable.
- Importing and exporting a `decorator` declaration MUST route through a
  namespace (`Module.decorators`/`Module.decoratorImports`) separate from
  `Module.funcs`/`Module.imports`, mirroring how rule/func imports and exports
  are tracked.

Postconditions:

- No code path exists by which an ordinary `func` can be invoked with
  decorator-style `this` binding, or by which a `decorator` declaration can be
  invoked with ordinary match-result `this` binding — the two are unreachable
  from each other's call sites by construction, not by a runtime check.

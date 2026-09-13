# Decorator declaration syntax

This chapter defines Uffda `decorator` declaration syntax: a top-level
declaration family, parallel to `rule` and `func`, that defines a named,
reusable callable applied to a `rule`/`func` declaration via `[Name arg…]`
attribute syntax.

## Logical purpose

A `decorator` declaration lets grammar authors attach reusable, named
annotations to a rule or func declaration — for example marking a rule as a
syntax-highlighting token kind, or flagging a func as deprecated — without
introducing a parallel, hand-maintained classification layer. See
[#159](https://github.com/justinmchase/uffda/issues/159).

`decorator` declarations exist in their own namespace, wholly separate from
`rule`/`func`. This is a deliberate structural choice, not an incidental detail:
it is what makes it impossible to invoke a decorator as an ordinary callable, or
to apply an ordinary func/rule as a decorator, or to encounter a rule/func name
that collides with a decorator name. See
[runtime rule metadata](../../runtime/rule-metadata.spec.md) for why this
matters for `this` binding, and
[declaration attribute syntax](./declaration-attributes.spec.md) for the
`[Name arg…]` syntax that applies a decorator to a declaration.

## Rough grammar

```text
DecoratorDeclaration = "decorator" Identifier ParameterList? "=" Expression ";" ;
```

`ParameterList` and `Expression` are parsed exactly as they are for `func`
declarations — see [func declaration syntax](./func-declarations.spec.md).

## Core contracts

- A `decorator` declaration MUST use the `decorator` keyword, followed by a
  name, an optional `<…>` parameter list, `=`, an expression, and a terminating
  `;` — structurally identical to a `func` declaration except for its keyword.
- A `decorator` declaration MUST be importable and exportable the same way a
  `rule`/`func` declaration is (`export decorator Name = …;`, or
  `decorator
  Name = …;` plus a later `export Name;`) — see
  [import and export declaration syntax](./import-and-export.spec.md).
- A `decorator` declaration's name MUST occupy its own namespace, distinct from
  every `rule`, `func`, and imported name in the same module. It MUST NOT
  collide with a rule/func/import name, and a rule/func/import name MUST NOT
  collide with it.
- A `decorator` declaration MUST NOT itself carry an attribute list (no
  `[Foo] decorator Bar = …;`). Decorators are not decoratable.
- A `decorator` declaration MUST NOT be referenced from an ordinary
  `ExpressionLang` expression (for example `(Name arg1 arg2)` inside a rule or
  func body). A decorator name is only ever resolved through attribute
  application.

## Why this design

- **Own keyword, own namespace, not a tagged `func`.** An earlier design let any
  ordinary `func` double as a decorator. That collapsed two incompatible calling
  conventions onto one declaration family: `this` meant a match result in
  ordinary invocation but the decorated `Rule`/`Func` in decorator invocation,
  with no static or dynamic guard distinguishing the two call sites. A distinct
  `decorator` keyword removes the ambiguity by construction — a decorator's body
  is only ever reached through the attribute-application path, so `this` has
  exactly one meaning there. See
  [runtime rule metadata](../../runtime/rule-metadata.spec.md).
- **Decorators are not decoratable.** Allowing `[Foo] decorator Bar = …;` would
  require topological ordering (or cycle detection) across decorator
  declarations before any of them could be considered "resolved enough" to
  validate as a decorator. Excluding decorators from the attribute target set
  keeps decorator resolution a single, ordering-free namespace lookup.
- **Structurally identical to `func` otherwise.** Reusing the exact parameter
  list and expression body grammar keeps the surface small and familiar; the
  only thing that changes is which namespace the declaration lives in and what
  `this` means inside it.

## Failure surface

- A `decorator` declaration name colliding with a `rule`, `func`, or imported
  name in the same module MUST fail declaration resolution, and vice versa.
- `[Foo]` where `Foo` names a `rule` or ordinary `func` (not a `decorator`
  declaration) MUST fail the same way an unresolvable reference fails — see
  [declaration attribute syntax](./declaration-attributes.spec.md).
- Referencing a `decorator` name from an ordinary expression MUST fail the same
  way any other unresolved reference fails, since decorator names are simply
  absent from the namespace ordinary references resolve against.

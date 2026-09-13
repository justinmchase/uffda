---
id: rule-decorators-003
title: Decorator invocation evaluates the resolved DecoratorFunc with author args and binds this to the decorated declaration's pre-decoration structural fields
spec_ref: ".agents/specifications/runtime/rule-metadata.spec.md#constraints; .agents/specifications/runtime/rule-metadata.spec.md#mechanism"
---

# Decorator Invocation and `this` Binding

## Requirement

Preconditions:

- A `rule` or `func` declaration carries one or more resolved attributes.

Expected behavior:

- Each attribute's decorator MUST be invoked as an ordinary `ExpressionLang`
  func invocation, evaluating its declared parameters against the written
  argument expressions, left to right.
- Decorator invocation MUST NOT depend on or trigger evaluation of the decorated
  declaration's own `pattern` or `expression` (matching behavior MUST remain
  unaffected by decoration).
- Within a decorator's body, `this` MUST resolve to the decorated `Rule` or
  `Func`, exposing only its pre-decoration structural fields: `name`, `module`,
  `pattern`, `parameters`, and `expression`.
- `this` MUST NOT expose `metadata` or `attributes`, including metadata already
  recorded by an earlier attribute in the same list.
- A decorator with no declared parameters MUST be invocable as a bare `[Name]`
  with zero arguments.
- Because a decorator's body is reachable only via attribute application (never
  via ordinary reference/invocation evaluation, per namespace separation),
  `this` MUST NOT resolve to a `MatchOk` inside a decorator's body under any
  call path.

Postconditions:

- A decorator applied to any rule/func declaration resolves and invokes without
  triggering recursion or depending on not-yet-computed metadata, because `this`
  never exposes in-progress decoration output — regardless of what the decorator
  or the decorated declaration are named.

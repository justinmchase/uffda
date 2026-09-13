# Declaration attribute syntax

This chapter defines Uffda attribute syntax: an optional, stackable prefix on
`rule`/`func` declarations that names a `decorator` declaration to invoke at
declaration-processing time.

## Logical purpose

Attributes let grammar authors apply a previously defined
[decorator declaration](./decorator-declarations.spec.md) to a rule or func —
for example marking a rule as a syntax-highlighting token kind, or flagging a
func as deprecated — without introducing a parallel, hand-maintained
classification layer. See
[#159](https://github.com/justinmchase/uffda/issues/159).

Attribute syntax only covers _where and how_ an attribute is written. Runtime
evaluation semantics (what invoking the named decorator does, how its result
attaches to the declaration) are governed by
[runtime rule metadata](../../runtime/rule-metadata.spec.md).

## Rough grammar

```text
Attribute      = "[" Identifier Argument* "]" ;
AttributeList  = Attribute+ ;
DecoratedDecl  = AttributeList? ( RuleDeclaration | FuncDeclaration ) ;
```

`Argument` is an `ExpressionLang` expression, parsed the same way invocation
arguments are parsed inside `(Name arg1 arg2)` — see
[function invocation](../expression-syntax/function-invocation.spec.md) — just
without the extra wrapping parens, since `[...]` is already the call delimiter.

## Core contracts

- An attribute list MUST consist of one or more `[Name]` / `[Name arg1 arg2]`
  groups, each written as its own bracket pair.
- An attribute list MAY immediately precede a `rule`, `export rule`, `func`, or
  `export func` declaration.
- An attribute list MUST NOT precede a `decorator` declaration; decorators are
  not decoratable — see
  [decorator declaration syntax](./decorator-declarations.spec.md).
- An attribute list MUST NOT introduce a new top-level declaration keyword
  family; it remains a prefix on the declaration it decorates, consistent with
  [module structure syntax](./module-structure.spec.md)'s requirement that every
  top-level declaration begin with a distinct declaration keyword token (the
  decorated declaration's own keyword, not the attribute itself).
- `Name` MUST be an identifier resolved against `decorator` declarations
  exclusively; it MUST NOT be a `rule` name, an ordinary `func` name, or any
  other name outside the decorator namespace.
- An empty argument list normalizes to a bare attribute (`[Name]`), invoking
  `Name` with zero arguments — consistent with func/decorator declarations' own
  zero-argument normalization.
- Arguments MUST be parsed as space-separated `ExpressionLang` expressions,
  matching ordinary invocation argument syntax minus the wrapping parens.
- Multiple attributes on one declaration MUST be written as separate stacked
  bracket groups (`[Foo][Bar]`, `[Foo 0][Bar 1]`), never as a comma-separated
  list inside one bracket pair.
- Attribute application order MUST be preserved in the canonical syntax tree, in
  the order the bracket groups are written (left to right, or top to bottom when
  authors place each on its own line).

## Why this design

- **Stacked brackets, not a comma list.** Since arguments are space-separated
  (no wrapping parens), a comma-separated attribute list would be ambiguous with
  a comma inside a single attribute's own argument list. Requiring each
  attribute to own its bracket pair removes that ambiguity entirely and gives an
  unambiguous application order for free.
- **Square brackets, not parens.** `(...)` is already the `ExpressionLang`
  invocation delimiter throughout this language; reusing it immediately before a
  declaration keyword would overload an already-loaded symbol at a new,
  unrelated grammar position. Square brackets are free at this position (per
  `module-structure.spec.md`, a bare array literal can never legally stand alone
  as a top-level declaration) and already carry a "list of things" connotation
  elsewhere in the language (array literals, array patterns), which fits "a list
  of applied attributes" well.
- **No wrapping parens around arguments.** `[...]` already signals "this is a
  call"; nesting `(...)` inside it would be redundant given the language's
  existing space-separated invocation-argument convention.
- **Resolved against `decorator` declarations only, not ordinary funcs.** An
  earlier design let any ordinary `func` double as an attribute target, which
  collapsed two incompatible `this`-binding conventions onto one declaration
  family. Restricting `Name` to the decorator namespace removes that ambiguity
  by construction — see
  [decorator declaration syntax](./decorator-declarations.spec.md) and
  [runtime rule metadata](../../runtime/rule-metadata.spec.md).

## Failure surface

- An attribute list on a declaration family other than `rule`/`func` (and their
  exported forms) MUST fail to parse.
- An attribute list preceding a `decorator` declaration MUST fail to parse.
- An unresolvable attribute `Name`, or a `Name` that resolves to a `rule` or
  ordinary `func` rather than a `decorator` declaration, MUST fail the same way
  an unresolvable reference fails elsewhere in this language.
- Applying the same resolved decorator more than once to a single declaration
  MUST fail; see [runtime rule metadata](../../runtime/rule-metadata.spec.md)
  for the exact failure condition, which can only be checked after `Name`
  resolution.

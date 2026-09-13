# Decorator declaration syntax

This chapter defines Uffda decorator syntax: an optional, stackable prefix on
`rule`/`func` declarations that names a `func` to invoke at declaration time.

## Logical purpose

Decorators let grammar authors attach reusable, named annotations to a rule or
func declaration — for example marking a rule as a syntax-highlighting token
kind, or flagging a func as deprecated — without introducing a parallel,
hand-maintained classification layer. See
[#159](https://github.com/justinmchase/uffda/issues/159).

Decorator syntax only covers _where and how_ a decorator is written. Runtime
evaluation semantics (what invoking a decorator does, how its result attaches to
the declaration) are governed by
[runtime rule metadata](../../runtime/rule-metadata.spec.md).

## Rough grammar

```text
Decorator      = "[" Identifier Argument* "]" ;
DecoratorList  = Decorator+ ;
DecoratedDecl  = DecoratorList? ( RuleDeclaration | FuncDeclaration ) ;
```

`Argument` is an `ExpressionLang` expression, parsed the same way invocation
arguments are parsed inside `(Name arg1 arg2)` — see
[function invocation](../expression-syntax/function-invocation.spec.md) — just
without the extra wrapping parens, since `[...]` is already the call delimiter.

## Core contracts

- A decorator list MUST consist of one or more `[Name]` / `[Name arg1 arg2]`
  groups, each written as its own bracket pair.
- A decorator list MAY immediately precede a `rule`, `export rule`, `func`, or
  `export func` declaration.
- A decorator list MUST NOT introduce a new top-level declaration keyword
  family; it remains a prefix on the declaration it decorates, consistent with
  [module structure syntax](./module-structure.spec.md)'s requirement that every
  top-level declaration begin with a distinct declaration keyword token (the
  decorated declaration's own keyword, not the decorator itself).
- `Name` MUST be an identifier resolved the same way any other reference name
  resolves (local func, imported func); it MUST NOT be a rule name.
- An empty argument list normalizes to a bare decorator (`[Name]`), invoking
  `Name` with zero arguments — consistent with func declarations' own
  zero-argument normalization.
- Arguments MUST be parsed as space-separated `ExpressionLang` expressions,
  matching ordinary invocation argument syntax minus the wrapping parens.
- Multiple decorators on one declaration MUST be written as separate stacked
  bracket groups (`[Foo][Bar]`, `[Foo 0][Bar 1]`), never as a comma-separated
  list inside one bracket pair.
- Decorator application order MUST be preserved in the canonical syntax tree, in
  the order the bracket groups are written (left to right, or top to bottom when
  authors place each on its own line).

## Why this design

- **Stacked brackets, not a comma list.** Since arguments are space-separated
  (no wrapping parens), a comma-separated decorator list would be ambiguous with
  a comma inside a single decorator's own argument list. Requiring each
  decorator to own its bracket pair removes that ambiguity entirely and gives an
  unambiguous application order for free.
- **Square brackets, not parens.** `(...)` is already the `ExpressionLang`
  invocation delimiter throughout this language; reusing it immediately before a
  declaration keyword would overload an already-loaded symbol at a new,
  unrelated grammar position. Square brackets are free at this position (per
  `module-structure.spec.md`, a bare array literal can never legally stand alone
  as a top-level declaration) and already carry a "list of things" connotation
  elsewhere in the language (array literals, array patterns), which fits "a list
  of applied decorators" well.
- **No wrapping parens around arguments.** `[...]` already signals "this is a
  call"; nesting `(...)` inside it would be redundant given the language's
  existing space-separated invocation-argument convention.

## Failure surface

- A decorator list on a declaration family other than `rule`/`func` (and their
  exported forms) MUST fail to parse.
- An unresolvable decorator `Name` MUST fail the same way an unresolvable
  reference fails elsewhere in this language.
- Applying the same resolved decorator func more than once to a single
  declaration MUST fail; see
  [runtime rule metadata](../../runtime/rule-metadata.spec.md) for the exact
  failure condition, which can only be checked after `Name` resolution.

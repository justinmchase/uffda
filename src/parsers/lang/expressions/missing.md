# Missing Expressions

This is a list of the remaining expressions that need to be implemented in order
to bootstrap.

| name                | example                                | parser    | status |
| ------------------- | -------------------------------------- | --------- | ------ |
| object literal      | `{}`, `{ a }`, `{ a:b }`, `{ [a]: b }` | lang      |        |
| index access        | `a[b]`, `(index a b)`                  | compiler  | x      |
| string literal      | `""`, `"abc"`                          | lang      |        |
| interpolated string | `"${a}"`, `(format "{0}" a)`           | lang      |        |
| not                 | `!`, `!!`, `(not x)`                   | lang      |        |
| array literal       | `[]`, `[a b c]`, `(array a b c)`       | lang      | ✔      |
| spread              | `...a`, `(concat a b)`                 | lang      | ✔      |
| lambda              | `k => k`                               | lang      |        |
| add                 | `a + b`, `(add a b)`                   | tokenizer | ✔      |
| ternary             | `a ? b : c`, `(ternary a b c)`         | compiler  |        |
| import              | `import { Foo } from "./foo.uff"`      | tokenizer |        |
| pipe                | `data \|> base64 = (base64 data)`      | future    |        |
| template            | `` `(f $x) ``                          | future    |        |
| match               | `x >> y`                               | future    |        |

# Index Access

`a[b]` is ambiguous with `(a [b])` therefore I think I'm going to rely on
non-syntactic array indexing for arrays such as `(at a b)` or `(pop a b)` etc.

For index access on objects you could use the same function but perhaps it would
be possible to also support something like `a."${b}"`

# Ternary

Ternary is just a terse syntactic form of
`switch (a) { case true: return b; case false: return c; }` in most languages,
which can be applied as an expression in just this one pattern case. In many
languages the switch statement is utilized as the pattern matching syntax.

This language is a pattern matching language in general, and so we will utilize
the [Match Expression](#Match_Expression) for the general replacement for the
switch statement and ternary expressions.

# Non Required Expressions

| name     | example    | status |
| -------- | ---------- | ------ |
| template | `` `(p) `` |        |
| match    | `e : p`    |        |

# Template Expressions

The syntax `` `(p) `` will be used to compile a pattern into AST (with special
references) which can be used as inputs to invocations or outputs of
projections.

# Match Expression

Match expression uses the left hand side as input and the right hand side as the
pattern to match against. The input must match, be read completely and not
produce any errors otherwise an Error will be thrown.

```
Ternary = a:boolean b:string c:string ->
  a >> true -> b
    | false -> c
  ;
```

```
(match [true "yes" "no"] Ternary) # yes
```

In the case above `b` and `c` are references to parameters in the scope of the
expression. They will be injected into the pattern as `SpecialReferences` and
ultimately returned as the values of their respective patterns.

# pipe

Pipe will take the result of the left side expression and pass it as the last
parameter to an invocation of the right side expression. If the right hand side
expression is an invocation expression then the left hand side will be passed as
the last parameter to that invocation.

|                simple | expanded        |
| --------------------: | --------------- |
|                   `t` | `t`             |
|                 `(f)` | `(f)`           |
|               `(f t)` | `(f t)`         |
|             `t \|> f` | `(f t)`         |
|           `(t) \|> f` | `(f (t))`       |
|           `t \|> (f)` | `((f) text)`    |
|           `(t \|> f)` | `((f t))`       |
|       `t \|> f \|> g` | `(g (f t))`     |
|   `t \|> (f x) \|> g` | `(g (f x t))`   |
| `a \|> b \|> c \|> d` | `(d (c (b a)))` |

# Rules and funcs

This chapter compares Uffda `rule` and `func` declarations: same Pattern →
Expression idea, different machines and required slots.

## Logical purpose

Both forms pair a PatternLang matcher with an ExpressionLang result. Authors
SHOULD treat Patterns as types for dynamic values. The declaration family
chooses **which runtime** runs the matcher and **what input** it sees.

## Shared shape

Rough grammar:

```text
rule Name … = Pattern ( "->" Expression )? ";"
func Name ( "<" Pattern ">" )? "=" Expression ";"
```

| Aspect                | Rule                                     | Func                                             |
| --------------------- | ---------------------------------------- | ------------------------------------------------ |
| Pattern slot          | **Required** (body after `=`)            | **Optional** (`<…>`; omitted/`<>` → `end`)       |
| Expression slot       | **Optional** (trailing `->` projection)  | **Required** (body after `=`)                    |
| Pattern input         | Current match stream (module/subject)    | Invocation **argument list** (iterable; no Into) |
| Invoked from          | Patterns (`Resolve` / rule name)         | Expressions (`(Name arg…)`)                      |
| Module registry       | `rules` / rule exports                   | `funcs` / func exports                           |
| Direct left recursion | Yes — named rule is a resolve/DLR target | No — param pattern is not a named rule           |

Both MAY be imported and exported. Both MUST reject name collisions with the
other family in the same module when binding imports.

## Where they run

- A **rule** is a named pattern machine. Other patterns invoke it; the pattern
  consumes (or fails on) the current input. An optional projection shapes the
  match value after a successful match.
- A **func** is a named expression callable. Expressions invoke it; the
  parameter pattern matches the argument list (Patterns-as-types) and, on
  success, the required expression body runs with bound variables.

So: rules from patterns, funcs from expressions. Same arrow, different call
sites and input kinds.

## Recursion

- **Rules** may recurse through the pattern layer: a rule name is a resolve
  target and MAY participate in direct left recursion (DLR) against the same
  stream.
- **Funcs** do not register their parameter pattern as a named rule, so that
  pattern MUST NOT be a DLR target. A func MAY still recurse as a **value** by
  invoking its own name from an expression (`(Fact n)` calling `Fact` again);
  that is ordinary call-stack recursion, not left-recursive pattern growth.

## Angle brackets (do not confuse)

- On a **rule**, `<P1, P2, …>` declares **rule parameters**: named pattern
  arguments supplied at resolve sites (`Rule<Arg…>`). They are not the main body
  pattern.
- On a **func**, `<Pattern>` is the **argument matcher** for `(Name …)` calls
  (for example `<a:number b:string>` or `<a:any*>`).

## References

- [Rule declaration syntax](./rule-declarations.spec.md)
- [Func declaration syntax](./func-declarations.spec.md)
- [Modules](../../modules.spec.md)
- [Direct left recursion](../../runtime/left-recursion.spec.md)

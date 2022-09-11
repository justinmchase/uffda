# Missing Expressions

This is a list of the remaining expressions that need to be implemented in order
to bootstrap.

| name                | example                                | parser    | status |
| ------------------- | -------------------------------------- | --------- | ------ |
| object literal      | `{}`, `{ a }`, `{ a:b }`, `{ [a]: b }` | lang      |        |
| index access        | `a[b]`                                 | compiler  |        |
| string literal      | `""`, `"abc"`                          | lang      |        |
| interpolated string | `"${a}"`                               | lang      |        |
| not                 | `!`, `!!`                              | lang      |        |
| array literal       | `[]`, `[a b c]`                        | lang      |        |
| spread              | `...a`                                 | lang      |        |
| lambda              | `k => k`                               | lang      |        |
| add                 | `a + b`                                | tokenizer | ✔      |
| ternary             | `a ? b : c`                            | compiler  |        |

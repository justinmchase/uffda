# Uffda 🦕

Uffda is a parser generator for domain specific languages.

It is different from many parser generators in that the syntax is expressive
enough to support parsing strings as well as objects, arrays or any other value
type. The result of this capability is that the entire compiler pipeline can be
expressed in pattern matching operations.

## How to use

```sh
import { uffda } from "https://deno.land/x/uffda/mod.ts";
```

### [Calc Example](./src/examples/calc.ts)

```ts
import { Basic, dsl, uffda } from "https://deno.land/x/uffda/mod.ts";

export const Calc = await uffda()`
  Number
    = ({ kind = 'Integer', i:value } -> i)
    ;
    
  Sub
    = (l:Sub { kind = 'Token', value = '-' } r:Number -> l - r)
    | Number
    ;

  Add
    = (l:Add { kind = 'Token', value = '+' } r:Sub -> l + r)
    | Sub
    ;

  Calc = Add;

  Main = ${Basic} > Calc;
`;

export const calc = dsl(import.meta.url, Calc);

// Parses a calculator dsl which procuces mathematical results
const { value } = calc`1 + 2 - 3`;
assert(value === 0);
```

## Development

This is a deno library.

#### test

```sh
deno test --allow-read --watch src --parallel
```

#### cli

```sh
deno run --allow-env --allow-read --allow-write \
  main.ts compile \
  --src src \
  --dst dst
```

### References

This project is based on a previous project I made called Meta# which was a C#
implementation of the ideas written in the OMeta paper by
[Alessandro Warth](http://www.tinlizzie.org/~awarth/).

> OMeta’s key insight is the realization that all of the passes in a traditional
> compiler are essentially pattern matching operations
>
> ~ Experimenting with Programming Languages, Alessandro Warth 2009

- [Experimenting with Programming Languages](http://www.vpri.org/pdf/tr2008003_experimenting.pdf)
- [ohm-js](https://ohmlang.github.io/)
- [meta#](https://archive.codeplex.com/?p=metasharp)

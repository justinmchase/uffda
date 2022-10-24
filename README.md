# Uffda 🦕

Uffda is a parser generator for domain specific languages.

It is different from many parser generators in that the syntax is expressive
enough to support parsing strings as well as objects, arrays or any other value
type. The result of this capability is that the entire compiler pipeline can be
expressed in pattern matching operations.

> OMeta’s key insight is the realization that all of the passes in a traditional
> compiler are essentially pattern matching operations
>
> ~ Experimenting with Programming Languages, Alessandro Warth 2009

## How to use

```sh
import { uffda } from "https://deno.land/x/uffda/mod.ts";
```

### [Calc Example](./src/examples/calc.ts)

```ts
import { Basic, dsl, Pattern, uffda } from "https://deno.land/x/uffda/mod.ts";

// This generates a parser which can be used as a basic calculator
const match = uffda`
  Number
    = ({ type = 'Integer', i:value } -> i)
    ;
    
  Sub
    = (l:Sub { type = 'Token', value = '-' } r:Number -> l - r)
    | Number
    ;

  Add
    = (l:Add { type = 'Token', value = '+' } r:Sub -> l + r)
    | Sub
    ;

  Calc = Add;

  Main = ${Basic} > Calc;
`;

export const Calc = match.value as Pattern;
export const calc = dsl(Calc);

// Parses a calculator dsl which procuces mathematical results
const { value } = calc`1+2`;
assert(value === 3);
```

## Development

This is a deno library.

```sh
deno test --watch --jobs 4
```

### Resources

This project is based on a previous project I made called Meta# which was a C#
implementation of the ideas written in the OMeta paper by
[Alessandro Warth](http://www.tinlizzie.org/~awarth/).

- [Experimenting with Programming Languages](http://www.vpri.org/pdf/tr2008003_experimenting.pdf)
- [ohm-js](https://ohmlang.github.io/)
- [meta#](https://archive.codeplex.com/?p=metasharp)

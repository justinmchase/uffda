# Uffda

_**NOTE**: work in progress!_

Uffda is a parser generator for domain specific languages.

It is different from many parser generators in that the syntax is expressive enough to support
parsing strings as well as objects, arrays or any other value type. The result of this capability
is that each step of the compiler can be expressed as dsl.

> OMeta’s key insight is the realization that all of the passes in a traditional compiler are essentially pattern matching operations
> 
> ~ Experimenting with Programming Languages, Alessandro Warth 2009

## How to use
```sh
npm i uffda
```

```ts
import { uffda } from "uffda"
import { Digit } from "uffda/parsers/tokenizer"

// This generates a parser which can be used as a 
export const calc = uffda`
  Add = x:Number '+' y:Number -> ${({ x, y }) => x + y}
  Number = i:${Digit} -> ${({ i }) => parseInt(i)}
  Main
    = Add
    | Number
`

// Parses a calculator dsl which procuces mathematical results
const { value } = calc`1+2`
assert(value === 3)

```

## Documentation

_This is a work in progress_

### Resources
This project is based on a previous project I made called Meta# which was a C# implementation of
the ideas written in the OMeta paper by [Alessandro Warth](http://www.tinlizzie.org/~awarth/).

* [Experimenting with Programming Languages](http://www.vpri.org/pdf/tr2008003_experimenting.pdf)
* [ohm-js](https://ohmlang.github.io/)
* [meta#](https://archive.codeplex.com/?p=metasharp)

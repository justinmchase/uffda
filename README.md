# J!

J! is a parser generator for domain specific languages.

> _**NOTE**: work in progress_

## How to use
```sh
npm i jbang
```

```ts
import { jbang } from "jbang"
import { Digit } from "jbang/parsers/tokenizer"

// This generates a parser which can be used as a 
export const calc = jbang`
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
This project is based on the ideas written in the OMeta paper by [Alessandro Warth](http://www.tinlizzie.org/~awarth/).

* [OMeta: an Object-Oriented Language for Pattern Matching](http://www.tinlizzie.org/~awarth/papers/dls07.pdf)

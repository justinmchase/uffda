import { strictEqual } from 'assert'
import { Digit } from '../parsers/tokenizer'
import { jbang } from '../jbang'

export const calc = jbang`
  Add = x:Number '+' y:Number -> ${({ x, y }) => x + y}
  Number = i:${Digit} -> ${({ i }) => parseInt(i)}
  Main
    = Add
    | Number
`

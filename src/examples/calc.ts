import { Digit } from '../parsers/tokenizer'
import { jbang } from '../jbang'

export const calc = jbang`
  Number = i:${Digit}+ -> ${({ i }) => parseInt(i.join(''))}
  Add = x:Number '+' y:Number -> ${({ x, y }) => x + y}
  Main
    = Add
    | Number
`

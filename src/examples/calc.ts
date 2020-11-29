import { uffda } from '../uffda'
import { Basic } from '../parsers'

export const calc2 = uffda`
  Number
    = { type = 'Integer', i:value } -> ${({ i }) => i}
    ;

  Add
    = l:Number { type = 'Token', value = '+' } r:Number
    -> ${({ l, r }) => l + r}
    ;

  Calc
    = Add
    | Number
    ;

  Main = ${Basic} > Calc;
`

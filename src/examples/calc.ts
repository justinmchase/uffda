import { Basic, dsl, uffda, code } from "../mod.ts";
import { Scope } from "../scope.ts";

export const Calc = await uffda`
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
`

export const calc = dsl<number>(import.meta.url, Calc)

// const ex0 = await calc('1 + 2 - 3') // 0
// const ex1 = await calc(code`7 + ${11}`) // 18
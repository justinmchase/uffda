import { Basic, dsl, uffda } from "../mod.ts";

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
`

export const calc = dsl(import.meta.url, Calc)

// const ex0 = await calc('1 + 2 - 3') // 0
// const ex1 = await calc(code`7 + ${11}`) // 18
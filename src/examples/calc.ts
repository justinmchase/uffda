import { Basic, dsl, uffda } from "../mod.ts";
import { Pattern } from "../runtime/patterns/mod.ts";

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

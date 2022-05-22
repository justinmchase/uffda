import { Basic, dsl, Pattern, uffda } from "../mod.ts";

const match = uffda`
  Number
    = { type = 'Integer', i:value } -> ${({ i }) => i}
    ;
    
  Sub
    = l:Sub { type = 'Token', value = '-' } r:Number -> ${({ l, r }) => l - r}
    | Number
    ;

  Add
    = l:Add { type = 'Token', value = '+' } r:Sub -> ${({ l, r }) => l + r}
    | Sub
    ;

  Calc = Add;

  Main = ${Basic} > Calc;
`;

export const Calc = match.value as Pattern;
export const calc = dsl(Calc);

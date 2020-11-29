import { Digit } from '../parsers/tokenizer'
import { uffda } from '../uffda'
import { Basic } from '../parsers'

// export const calc = uffda`
//   Number = i:${Digit}+ -> ${({ i }) => parseInt(i.join(''))};
//   Add = x:Number '+' y:Number -> ${({ x, y }) => x + y};
//   Calc
//     = Add
//     | Number
//     ;
//   Main = Calc;
// `

// todo: Make calc2 work
// 1. ✅ 'String' literals need to get parsed as equal
// 2. ✅ Support shorthand `i:key` which is equivalent to `key = i:any`
// 3. ✅ Support `,` between keys
// 4. ✅ Ensure property variable is available in projection of object pattern

export const calc2 = uffda`
  Number
    = { type = 'Integer', i:value } -> ${({ i, _ }) => (console.log({ i, _ }), i)}
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

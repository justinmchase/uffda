import { strictEqual } from 'assert'
import { jbang } from '../jbang'

export const calc = jbang`
  Add = x:Number '+' y:Number -> ${(x: number, y: number) => x + y}
`

// todo:
// 1. implement .. operator
// 2. add below expressions into the above lang

//   Number = i:'0'..'9'+ -> ${(i: string) => parseInt(i)}
//   Main
//     = Add
//     | Number
// `


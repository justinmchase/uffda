// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { Digit } from './Digit'

// describe('/parsers/tokenizer/digit', () => {
//   it('matches a digit', () => {
//     const p = Digit
//     const s = Scope.From('1')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: '1'
//     })
//   })

//   it('does not match a non-digit', () => {
//     const p = Digit
//     const s = Scope.From('*')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: false,
//       value: undefined
//     })
//   })
// })

// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { Newline } from './Newline'

// describe('/parsers/tokenizer/newline', () => {
//   it('can match slash n', () => {
//     const p = Newline
//     const s = Scope.From('\n')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: '\n'
//     })
//   })

//   it('can match slash r', () => {
//     const p = Newline
//     const s = Scope.From('\r')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: '\r'
//     })
//   })

//   it('can match slash r slash n', () => {
//     const p = Newline
//     const s = Scope.From('\r\n')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: '\r\n'
//     })
//   })
// })

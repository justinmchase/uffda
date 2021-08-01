// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { OneOrMorePattern } from './OneOrMorePattern'

// describe('/parsers/lang/oneormore', () => {
//   it('parse one or more reference', () => {
//     const p = OneOrMorePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: '+' }
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'OneOrMorePattern',
//         pattern: {
//           type: 'ReferencePattern',
//           value: 'x'
//         }
//       }
//     })
//   })
// })

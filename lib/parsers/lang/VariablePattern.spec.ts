// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { VariablePattern } from './VariablePattern'

// describe('/parsers/lang/variablepattern', () => {
//   it('can parse a reference as a variable', () => {
//     const p = VariablePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: ':' },
//       { type: 'Identifier', value: 'y' }
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'VariablePattern',
//         name: 'x',
//         value: {
//           type: 'ReferencePattern',
//           value: 'y'
//         }
//       }
//     })
//   })

//   it('can parse a reference as a reference', () => {
//     const p = VariablePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' }
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'ReferencePattern',
//         value: 'x'
//       }
//     })
//   })
// })

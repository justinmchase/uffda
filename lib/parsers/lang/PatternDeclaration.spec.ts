// import { deepStrictEqual, strictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { PatternDeclaration } from './PatternDeclaration'

// describe('/parsers/lang/patterndeclaration', () => {
//   it('can parse pattern declaration', () => {
//     const p = PatternDeclaration
//     const s = Scope
//       .From([
//         { type: 'Identifier', value: 'x' },
//         { type: 'Token', value: '=' },
//         { type: 'Identifier', value: 'y' },
//         { type: 'Token', value: ';' }
//       ])

//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'PatternDeclaration',
//         name: 'x',
//         pattern: {
//           type: 'ReferencePattern',
//           value: 'y'
//         }
//       }
//     })
//   })

//   it('can parse pattern declaration with variable', () => {
//     const p = PatternDeclaration
//     const s = Scope
//       .From([
//         { type: 'Identifier', value: 'x' },
//         { type: 'Token', value: '=' },
//         { type: 'Identifier', value: 'y' },
//         { type: 'Token', value: ':', },
//         { type: 'Identifier', value: 'z' },
//         { type: 'Token', value: ';' },
//       ])

//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'PatternDeclaration',
//         name: 'x',
//         pattern: {
//           type: 'VariablePattern',
//           name: 'y',
//           value: {
//             type: 'ReferencePattern',
//             value: 'z'
//           }
//         }
//       }
//     })
//   })
// })

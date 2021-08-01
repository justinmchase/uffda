// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { SlicePattern } from './SlicePattern'

// describe('/parsers/lang/slice', () => {
//   it('parses a terminal', () => {
//     const p = SlicePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
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

//   it('parses one or more', () => {
//     const p = SlicePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: '+' },
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

//   it('parses zero or more', () => {
//     const p = SlicePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: '*' },
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'ZeroOrMorePattern',
//         pattern: {
//           type: 'ReferencePattern',
//           value: 'x'
//         }
//       }
//     })
//   })

//   it('parses zero or one', () => {
//     const p = SlicePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: '?' },
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: {
//         type: 'ZeroOrOnePattern',
//         pattern: {
//           type: 'ReferencePattern',
//           value: 'x'
//         }
//       }
//     })
//   })
// })

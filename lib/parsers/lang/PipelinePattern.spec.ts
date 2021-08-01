// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { PipelinePattern } from './PipelinePattern'

// describe('/parsers/lang/pipeline', () => {
//   it('it can pipe two steps', () => {
//     const p = PipelinePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' },
//       { type: 'Token', value: '>' },
//       { type: 'Identifier', value: 'y' }
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched,
//       done,
//       value: {
//         type: 'PipelinePattern',
//         left: {
//           type: 'ReferencePattern',
//           value: 'x'
//         },
//         right: {
//           type: 'ReferencePattern',
//           value: 'y'
//         }
//       }
//     })
//   })
// })

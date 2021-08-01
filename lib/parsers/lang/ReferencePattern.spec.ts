// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { ReferencePattern } from './ReferencePattern'

// describe('/parsers/lang/referencepattern', () => {
//   it('can parse an identifier as a reference', () => {
//     const p = ReferencePattern
//     const s = Scope.From([
//       { type: 'Identifier', value: 'x' }
//     ])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: { type: 'ReferencePattern', value: 'x' }
//     })
//   })
// })

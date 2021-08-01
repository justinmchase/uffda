// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { String } from './String'

// describe('/parsers/tokenizer/stringpattern', () => {
//   it('can parse empty single quote string', () => {
//     const p = String
//     const s = Scope.From('\'\'')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: ''
//     })
//   })

//   it('can parse single quote string', () => {
//     const p = String
//     const s = Scope.From('\'a\'')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 'a'
//     })
//   })

//   it('can parse single quote string with multiple characters', () => {
//     const p = String
//     const s = Scope.From('\'abc\'')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 'abc'
//     })
//   })

//   it('can parse string with escaped single-quote', () => {
//     const p = String
//     const s = Scope.From('\'abc\\\'xyz\'')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 'abc\'xyz'
//     })
//   })
// })

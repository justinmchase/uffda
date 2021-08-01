// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { Tokenizer } from './index'

// describe('/parsers/tokenizer', () => {
//   it('succeeds on empty input', () => {
//     const p = Tokenizer
//     const s = Scope.From('')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: []
//     })
//   })

//   it('succeeds on whitespace', () => {
//     const p = Tokenizer
//     const s = Scope.From(' ')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: [
//         { type: 'Whitespace', value: ' ' }
//       ]
//     })
//   })

//   it('succeeds on multiple lines', () => {
//     const p = Tokenizer
//     const s = Scope.From('   \n   \n   ')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: [
//         { type: 'Whitespace', value: '   ' },
//         { type: 'Newline', value: '\n' },
//         { type: 'Whitespace', value: '   ' },
//         { type: 'Newline', value: '\n' },
//         { type: 'Whitespace', value: '   ' },
//       ]
//     })
//   })

//   it('successfully parses expressions', () => {
//     const p = Tokenizer
//     const s = Scope.From('x + y - 1')
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: [
//         { type: 'Identifier', value: 'x' },
//         { type: 'Whitespace', value: ' ' },
//         { type: 'Token', value: '+' },
//         { type: 'Whitespace', value: ' ' },
//         { type: 'Identifier', value: 'y' },
//         { type: 'Whitespace', value: ' ' },
//         { type: 'Token', value: '-' },
//         { type: 'Whitespace', value: ' ' },
//         { type: 'Integer', value: 1 }
//       ]
//     })
//   })
// })

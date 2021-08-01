// import { deepStrictEqual } from 'assert'
// import { Scope } from '../../scope'
// import { Whitespace } from './Whitespace'

// describe('/parsers/tokenizer/whiespace', () => {
//   it('can match space', () => {
//     const p = Whitespace
//     const s = Scope.From(' ')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: ' '
//     })
//   })

//   it('can match tab', () => {
//     const p = Whitespace
//     const s = Scope.From('\t')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: true,
//       value: '\t'
//     })
//   })

//   it('does not match newline', () => {
//     const p = Whitespace
//     const s = Scope.From('\n')
//     const { matched, value } = p(s)
//     deepStrictEqual({ matched, value }, {
//       matched: false,
//       value: undefined
//     })
//   })
// })

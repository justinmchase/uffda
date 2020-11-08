import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { Identifier } from './Identifier'

describe('/parsers/tokenizer/identifier', () => {
  it('matches a character', () => {
    const p = Identifier
    const s = Scope.From('a')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'a'
    })
  })

  it('matches a word', () => {
    const p = Identifier
    const s = Scope.From('abc')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'abc'
    })
  })

  it('does not match a leading digit', () => {
    const p = Identifier
    const s = Scope.From('1abc')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })

  it('matches a word followed by digits', () => {
    const p = Identifier
    const s = Scope.From('abc123')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'abc123'
    })
  })

  it('matches interleaved letters and numbers', () => {
    const p = Identifier
    const s = Scope.From('a1b2c3')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'a1b2c3'
    })
  })
})
